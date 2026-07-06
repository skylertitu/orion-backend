import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Progress', () => {
  let app: Express
  let teacherToken = ''
  let studentToken = ''
  let courseId = ''
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

    const course = await request(app).post('/api/courses').set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Progress Test Course',
    })
    courseId = course.body.id

    const lesson = await request(app).post(`/api/courses/${courseId}/lessons`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Progress Lesson 1',
    })
    lessonId = lesson.body.id

    await request(app).post(`/api/courses/${courseId}/enroll`).set('Authorization', `Bearer ${studentToken}`)
  })

  it('PUT /api/progress/:courseId/:lessonId marks complete', async () => {
    const res = await request(app).put(`/api/progress/${courseId}/${lessonId}`).set('Authorization', `Bearer ${studentToken}`).send({
      completed: true,
    })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const entry = res.body.find((p: any) => p.lesson_id === lessonId)
    expect(entry).toBeDefined()
    expect(entry.completed).toBe(1)
  })

  it('GET /api/progress/:courseId returns progress', async () => {
    const res = await request(app).get(`/api/progress/${courseId}`).set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })

  it('PUT /api/progress/:courseId/:lessonId marks incomplete', async () => {
    const res = await request(app).put(`/api/progress/${courseId}/${lessonId}`).set('Authorization', `Bearer ${studentToken}`).send({
      completed: false,
    })
    expect(res.status).toBe(200)
    const entry = res.body.find((p: any) => p.lesson_id === lessonId)
    expect(entry).toBeDefined()
    expect(entry.completed).toBe(0)
  })
})
