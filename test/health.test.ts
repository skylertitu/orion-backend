import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { getApp } from './helpers.js'

describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const app = await getApp()
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })
})
