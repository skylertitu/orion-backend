import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Users', () => {
  let app: Express
  let token = ''

  beforeAll(async () => {
    app = await getApp()

    const res = await request(app).post('/api/auth/login').send({
      email: 'student@tradingacademy.com',
      password: 'student123',
    })
    token = res.body.token
  })

  it('GET /api/users returns user list', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(3)
  })

  it('GET /api/users without auth returns 401', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })

  it('GET /api/users/counts returns counts', async () => {
    const res = await request(app).get('/api/users/counts').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(3)
    expect(res.body.admin).toBeGreaterThanOrEqual(1)
    expect(res.body.teacher).toBeGreaterThanOrEqual(1)
    expect(res.body.student).toBeGreaterThanOrEqual(1)
  })

  it('PUT /api/users/profile updates name', async () => {
    const res = await request(app).put('/api/users/profile').set('Authorization', `Bearer ${token}`).send({ name: 'Updated Name' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
  })
})
