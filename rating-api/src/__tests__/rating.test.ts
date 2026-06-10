import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { dbMock, redisMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}))

vi.mock('../db', () => ({ db: dbMock, redis: redisMock }))

import app from '../index'

function selectResults(...results: any[][]) {
  const queue = [...results]
  dbMock.select.mockImplementation(() => ({
    from: () => ({
      where: () => queue.shift() ?? [],
      orderBy: () => queue.shift() ?? [],
    }),
  }))
}

function mockInsertReturning(...results: any[]) {
  const queue = [...results]
  dbMock.insert.mockImplementation(() => ({
    values: () => ({
      returning: () => [queue.shift()],
    }),
  }))
}

function mockTransaction() {
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  }
  dbMock.transaction.mockImplementation(async (callback: any) => callback(tx))
  return tx
}

const resetMocks = () => {
  vi.clearAllMocks()
  dbMock.select.mockReset()
  dbMock.insert.mockReset()
  dbMock.transaction.mockReset()
  redisMock.get.mockReset()
  redisMock.set.mockReset()
  redisMock.del.mockReset()
}

describe('rating endpoints', () => {
  beforeEach(() => resetMocks())

  it('GET /rating returns cached leaderboard when available', async () => {
    const cached = [{ id: 'u1', username: 'a', rating: 1200 }]
    redisMock.get.mockResolvedValueOnce(JSON.stringify(cached))

    const res = await request(app).get('/rating')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(cached)
    expect(redisMock.get).toHaveBeenCalledWith('leaderboard')
    expect(dbMock.select).not.toHaveBeenCalled()
  })

  it('GET /rating queries DB, serializes public ids, and caches', async () => {
    const board = [
      { id: 2, externalId: 'u2', username: 'b', rating: 1300 },
      { id: 1, externalId: 'u1', username: 'a', rating: 1200 },
    ]
    redisMock.get.mockResolvedValueOnce(null)
    selectResults(board)

    const res = await request(app).get('/rating')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 'u2', externalId: 'u2', username: 'b', rating: 1300 },
      { id: 'u1', externalId: 'u1', username: 'a', rating: 1200 },
    ])
    expect(redisMock.set).toHaveBeenCalled()
  })

  it('GET /rating/:id returns rating for existing UUID player', async () => {
    const player = { id: 42, externalId: 'user-uuid', rating: 1500 }
    selectResults([player])

    const res = await request(app).get('/rating/user-uuid')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'user-uuid', rating: 1500 })
  })

  it('GET /rating/:id still supports legacy numeric ids', async () => {
    const player = { id: 42, externalId: null, rating: 1500 }
    selectResults([player])

    const res = await request(app).get('/rating/42')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: '42', rating: 1500 })
  })

  it('GET /rating/:id 404 when not found', async () => {
    selectResults([], [])

    const res = await request(app).get('/rating/user-uuid')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })

  it('POST /rating/report accepts UUID players and records internal ids', async () => {
    const p1 = { id: 10, externalId: 'u1', rating: 1000 }
    const p2 = { id: 20, externalId: 'u2', rating: 1000 }
    selectResults([p1], [p2])
    const tx = mockTransaction()

    const res = await request(app)
      .post('/rating/report')
      .send({ player1Id: 'u1', player2Id: 'u2', winnerId: 'u1', mode: 'blitz' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ player1Id: 'u1', rating1: 1016, player2Id: 'u2', rating2: 984, winnerId: 'u1' })
    expect(tx.update).toHaveBeenCalledTimes(2)
    expect(tx.insert).toHaveBeenCalledTimes(1)
    expect(redisMock.del).toHaveBeenCalledWith('leaderboard')
  })

  it('POST /rating/report creates missing UUID players with default ratings', async () => {
    const p1 = { id: 10, externalId: 'u1', rating: 1000 }
    const p2 = { id: 20, externalId: 'u2', rating: 1000 }
    selectResults([], [], [], [])
    mockInsertReturning(p1, p2)
    mockTransaction()

    const res = await request(app)
      .post('/rating/report')
      .send({ player1Id: 'u1', player2Id: 'u2', winnerId: null, mode: 'rapid' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ player1Id: 'u1', rating1: 1000, player2Id: 'u2', rating2: 1000, winnerId: null })
    expect(dbMock.insert).toHaveBeenCalledTimes(2)
  })

  it('POST /rating/report rejects winner outside the match', async () => {
    const res = await request(app)
      .post('/rating/report')
      .send({ player1Id: 'u1', player2Id: 'u2', winnerId: 'u3', mode: 'blitz' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Invalid winner')
  })
})
