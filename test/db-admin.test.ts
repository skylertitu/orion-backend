import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('DbAdmin', () => {
  let app: Express
  let adminToken = ''
  let studentToken = ''

  beforeAll(async () => {
    app = await getApp()

    const admin = await request(app).post('/api/auth/login').send({
      email: 'admin@tradingacademy.com', password: 'admin123',
    })
    adminToken = admin.body.token

    const student = await request(app).post('/api/auth/login').send({
      email: 'student@tradingacademy.com', password: 'student123',
    })
    studentToken = student.body.token
  })

  it('GET /api/db/tables returns table list (admin)', async () => {
    const res = await request(app).get('/api/db/tables').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toContain('users')
  })

  it('GET /api/db/tables rejects non-admin', async () => {
    const res = await request(app).get('/api/db/tables').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /api/db/table/:name returns table content', async () => {
    const res = await request(app).get('/api/db/table/users').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/db/table/:name rejects disallowed table', async () => {
    const res = await request(app).get('/api/db/table/sqlite_master').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('POST /api/db/query executes SELECT (admin)', async () => {
    const res = await request(app).post('/api/db/query').set('Authorization', `Bearer ${adminToken}`).send({
      sql: 'SELECT COUNT(*) as cnt FROM users',
    })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].cnt).toBeGreaterThanOrEqual(3)
  })

  it('POST /api/db/query rejects non-SELECT', async () => {
    const res = await request(app).post('/api/db/query').set('Authorization', `Bearer ${adminToken}`).send({
      sql: 'DELETE FROM users',
    })
    expect(res.status).toBe(400)
  })
})
