import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Auth', () => {
  let app: Express

  beforeAll(async () => {
    app = await getApp()
  })

  const testUser = {
    name: 'Test User',
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@test.com`,
    password: 'test123456',
  }
  let token = ''

  it('POST /api/auth/register creates user', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser)
    expect(res.status).toBe(200)
    expect(res.body.user).toBeDefined()
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe(testUser.email)
    expect(res.body.user.role).toBe('student')
    token = res.body.token
  })

  it('POST /api/auth/register rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser)
    expect(res.status).toBe(400)
  })

  it('POST /api/auth/register rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad@test.com' })
    expect(res.status).toBe(400)
  })

  it('POST /api/auth/login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe(testUser.email)
    token = res.body.token
  })

  it('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'wrongpassword',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/auth/login with non-existent email returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@test.com',
      password: 'somepassword',
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me with valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe(testUser.email)
  })

  it('GET /api/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me with invalid token returns 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalidtoken123')
    expect(res.status).toBe(401)
  })

  it('POST /api/auth/logout works', async () => {
    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(me.status).toBe(401)
  })
})
