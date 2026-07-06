import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Notifications', () => {
  let app: Express
  let studentToken = ''

  beforeAll(async () => {
    app = await getApp()

    const student = await request(app).post('/api/auth/login').send({
      email: 'student@tradingacademy.com', password: 'student123',
    })
    studentToken = student.body.token
  })

  it('GET /api/notifications returns list', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/notifications/unread-count returns number', async () => {
    const res = await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body).toBe('number')
  })

  it('PUT /api/notifications/read-all marks all as read', async () => {
    const res = await request(app).put('/api/notifications/read-all').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const unread = await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${studentToken}`)
    expect(unread.body).toBe(0)
  })
})
