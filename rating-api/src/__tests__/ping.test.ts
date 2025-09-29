import request from 'supertest'
import app from '../index'

describe('GET /ping', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/ping')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
