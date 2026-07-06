import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Submissions', () => {
  let app: Express
  let teacherToken = ''
  let studentToken = ''
  let taskId = ''
  let submissionId = ''

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

    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Submissions Test Task',
    })
    taskId = task.body.id
  })

  it('POST /api/submissions creates submission', async () => {
    const res = await request(app).post('/api/submissions').set('Authorization', `Bearer ${studentToken}`).send({
      task_id: taskId,
      content: 'My submission content',
    })
    expect(res.status).toBe(200)
    expect(res.body.task_id).toBe(taskId)
    submissionId = res.body.id
  })

  it('POST /api/submissions upserts (same task+student)', async () => {
    const res = await request(app).post('/api/submissions').set('Authorization', `Bearer ${studentToken}`).send({
      task_id: taskId,
      content: 'Updated submission content',
    })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(submissionId)
    expect(res.body.content).toBe('Updated submission content')
  })

  it('GET /api/submissions/task/:taskId returns submissions', async () => {
    const res = await request(app).get(`/api/submissions/task/${taskId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/submissions/student/:studentId returns student submissions', async () => {
    const res = await request(app).get('/api/submissions/student/demo-student').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/submissions/summary returns summary', async () => {
    const res = await request(app).get('/api/submissions/summary').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('PUT /api/submissions/:id/grade sets grade', async () => {
    const res = await request(app).put(`/api/submissions/${submissionId}/grade`).set('Authorization', `Bearer ${teacherToken}`).send({
      grade: 95,
    })
    expect(res.status).toBe(200)
    expect(res.body.grade).toBe(95)
  })

  it('PUT /api/submissions/:id/grade rejects student', async () => {
    const res = await request(app).put(`/api/submissions/${submissionId}/grade`).set('Authorization', `Bearer ${studentToken}`).send({
      grade: 100,
    })
    expect(res.status).toBe(403)
  })
})
