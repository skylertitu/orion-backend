import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Lessons', () => {
  let app: Express
  let teacherToken = ''
  let studentToken = ''
  let lessonId = ''

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

  it('GET /api/lessons returns list', async () => {
    const res = await request(app).get('/api/lessons').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/lessons/count returns number', async () => {
    const res = await request(app).get('/api/lessons/count').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body).toBe('number')
  })

  it('GET /api/lessons/teacher returns teacher lessons', async () => {
    const res = await request(app).get('/api/lessons/teacher').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/lessons creates lesson (teacher)', async () => {
    const res = await request(app).post('/api/lessons').set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Test Lesson', content: 'Lesson content', date: '2025-01-01',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Test Lesson')
    lessonId = res.body.id
  })

  it('POST /api/lessons rejects student', async () => {
    const res = await request(app).post('/api/lessons').set('Authorization', `Bearer ${studentToken}`).send({
      title: 'Student Lesson',
    })
    expect(res.status).toBe(403)
  })

  it('PUT /api/lessons/:id updates lesson', async () => {
    const res = await request(app).put(`/api/lessons/${lessonId}`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Updated Lesson',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Lesson')
  })

  it('DELETE /api/lessons/:id deletes lesson', async () => {
    const res = await request(app).delete(`/api/lessons/${lessonId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('DELETE /api/lessons/:id nonexistent returns 404', async () => {
    const res = await request(app).delete(`/api/lessons/${lessonId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
  })
})
