import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Meetings', () => {
  let app: Express
  let teacherToken = ''
  let studentToken = ''
  let meetingId = ''

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

  it('GET /api/meetings returns list', async () => {
    const res = await request(app).get('/api/meetings').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/meetings/count returns number', async () => {
    const res = await request(app).get('/api/meetings/count').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body).toBe('number')
  })

  it('GET /api/meetings/teacher returns teacher meetings', async () => {
    const res = await request(app).get('/api/meetings/teacher').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/meetings/next returns null when no upcoming', async () => {
    const res = await request(app).get('/api/meetings/next').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })

  it('POST /api/meetings creates meeting (teacher)', async () => {
    const res = await request(app).post('/api/meetings').set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Test Meeting', date: '2099-12-31', time: '10:00', platform: 'Zoom',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Test Meeting')
    meetingId = res.body.id
  })

  it('POST /api/meetings rejects student', async () => {
    const res = await request(app).post('/api/meetings').set('Authorization', `Bearer ${studentToken}`).send({
      title: 'Student Meeting',
    })
    expect(res.status).toBe(403)
  })

  it('PUT /api/meetings/:id updates meeting', async () => {
    const res = await request(app).put(`/api/meetings/${meetingId}`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Updated Meeting', date: '2099-12-31',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Meeting')
  })

  it('GET /api/meetings/next returns upcoming meeting', async () => {
    const res = await request(app).get('/api/meetings/next').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body).not.toBeNull()
    expect(res.body.title).toBe('Updated Meeting')
  })

  it('DELETE /api/meetings/:id deletes meeting', async () => {
    const res = await request(app).delete(`/api/meetings/${meetingId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
