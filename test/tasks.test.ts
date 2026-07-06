import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Tasks', () => {
  let app: Express
  let teacherToken = ''
  let studentToken = ''
  let taskId = ''

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

  it('GET /api/tasks returns list', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/tasks/count returns number', async () => {
    const res = await request(app).get('/api/tasks/count').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body).toBe('number')
  })

  it('GET /api/tasks/teacher returns teacher tasks', async () => {
    const res = await request(app).get('/api/tasks/teacher').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/tasks creates task (teacher)', async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Test Task', description: 'Task description', due_date: '2025-02-01',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Test Task')
    taskId = res.body.id
  })

  it('POST /api/tasks rejects student', async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${studentToken}`).send({
      title: 'Student Task',
    })
    expect(res.status).toBe(403)
  })

  it('PUT /api/tasks/:id updates task', async () => {
    const res = await request(app).put(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Updated Task',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Task')
  })

  it('DELETE /api/tasks/:id deletes task', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
