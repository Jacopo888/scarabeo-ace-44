import request from 'supertest'
import express from 'express'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Build absolute module path to ensure the mock matches router's './db' import
const dbModulePath = new URL('../db.ts', import.meta.url).pathname

const dbMock: any = {
  select: vi.fn(),
  transaction: vi.fn(),
}
const redisMock: any = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}

vi.mock(dbModulePath, () => ({ db: dbMock, redis: redisMock }))

// Import after mocking
import app from '../index'

const resetMocks = () => {
  vi.clearAllMocks()
  dbMock.select.mockReset()
  dbMock.transaction.mockReset()
  redisMock.get.mockReset()
  redisMock.set.mockReset()
  redisMock.del.mockReset()
}

describe('rating endpoints', () => {
  beforeEach(() => resetMocks())

  it('GET /rating returns cached leaderboard when available', async () => {
    const cached = [{ id: 1, username: 'a', rating: 1200 }]
    redisMock.get.mockResolvedValueOnce(JSON.stringify(cached))

    const res = await request(app).get('/rating')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(cached)
    expect(redisMock.get).toHaveBeenCalledWith('leaderboard')
    expect(dbMock.select).not.toHaveBeenCalled()
  })

  it('GET /rating queries DB and caches when not cached', async () => {
    const board = [
      { id: 2, username: 'b', rating: 1300 },
      { id: 1, username: 'a', rating: 1200 },
    ]
    redisMock.get.mockResolvedValueOnce(null)
    // Chain: select().from().orderBy() -> board
    dbMock.select.mockReturnValue({
      from: () => ({
        orderBy: () => board,
      }),
    })

    const res = await request(app).get('/rating')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(board)
    expect(redisMock.set).toHaveBeenCalled()
  })

  it('GET /rating/:id returns rating for existing player', async () => {
    // Chain: select().from().where() -> [player]
    const player = { id: 42, rating: 1500 }
    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => [player],
      }),
    })

    const res = await request(app).get('/rating/42')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 42, rating: 1500 })
  })

  it('GET /rating/:id 400 on invalid id', async () => {
    const res = await request(app).get('/rating/abc')
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('GET /rating/:id 404 when not found', async () => {
    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => [],
      }),
    })
    const res = await request(app).get('/rating/123')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})
