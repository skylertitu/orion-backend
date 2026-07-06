import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Announcements', () => {
  let app: Express
  let teacherToken = ''
  let studentToken = ''
  let announcementId = ''

  beforeAll(async () => {
    app = await getApp()

    const teacher = await request(app).post('/api/auth/login').send({
      email: 'teacher@tradingacademy.com', password: 'teacher123',
    })
    teacherToken = teacher.body.token

    const student = await request(app).post('/api/auth/login').send({
      email: 'student@tradingacademy.com', password: 'student123',
    })
    studentToken = student.body.token
  })

  it('GET /api/announcements returns list', async () => {
    const res = await request(app).get('/api/announcements').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/announcements?limit=1', async () => {
    const res = await request(app).get('/api/announcements?limit=1').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.length).toBeLessThanOrEqual(1)
  })

  it('GET /api/announcements/teacher returns teacher announcements', async () => {
    const res = await request(app).get('/api/announcements/teacher').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/announcements creates announcement (teacher)', async () => {
    const res = await request(app).post('/api/announcements').set('Authorization', `Bearer ${teacherToken}`).send({
      content: 'Test announcement content',
    })
    expect(res.status).toBe(200)
    expect(res.body.content).toBe('Test announcement content')
    announcementId = res.body.id
  })

  it('POST /api/announcements rejects student', async () => {
    const res = await request(app).post('/api/announcements').set('Authorization', `Bearer ${studentToken}`).send({
      content: 'Student announcement',
    })
    expect(res.status).toBe(403)
  })

  it('DELETE /api/announcements/:id deletes announcement', async () => {
    const res = await request(app).delete(`/api/announcements/${announcementId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
