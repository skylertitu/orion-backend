import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { getApp } from './helpers.js'

describe('Courses', () => {
  let app: Express
  let teacherToken = ''
  let studentToken = ''
  let courseId = ''
  let lessonId = ''
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

  it('GET /api/courses returns list', async () => {
    const res = await request(app).get('/api/courses').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('POST /api/courses creates course (teacher)', async () => {
    const res = await request(app).post('/api/courses').set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Test Course', description: 'A test course',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Test Course')
    courseId = res.body.id
  })

  it('POST /api/courses rejects student', async () => {
    const res = await request(app).post('/api/courses').set('Authorization', `Bearer ${studentToken}`).send({
      title: 'Student Course',
    })
    expect(res.status).toBe(403)
  })

  it('GET /api/courses/teacher returns teacher courses', async () => {
    const res = await request(app).get('/api/courses/teacher').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((c: any) => c.id === courseId)).toBe(true)
  })

  it('GET /api/courses/:id returns single course', async () => {
    const res = await request(app).get(`/api/courses/${courseId}`).set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(courseId)
    expect(res.body.title).toBe('Test Course')
  })

  it('PUT /api/courses/:id updates course', async () => {
    const res = await request(app).put(`/api/courses/${courseId}`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Updated Course',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Course')
  })

  it('POST /api/courses/:courseId/enroll enrolls student', async () => {
    const res = await request(app).post(`/api/courses/${courseId}/enroll`).set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('POST /api/courses/:courseId/enroll rejects duplicate', async () => {
    const res = await request(app).post(`/api/courses/${courseId}/enroll`).set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(400)
  })

  it('GET /api/courses/student/:studentId returns enrolled courses', async () => {
    const res = await request(app).get('/api/courses/student/demo-student').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((c: any) => c.id === courseId)).toBe(true)
  })

  it('POST /api/courses/:courseId/lessons adds lesson', async () => {
    const res = await request(app).post(`/api/courses/${courseId}/lessons`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Course Lesson 1', content: 'Lesson content',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Course Lesson 1')
    lessonId = res.body.id
  })

  it('PUT /api/courses/:courseId/lessons/:lessonId updates lesson', async () => {
    const res = await request(app).put(`/api/courses/${courseId}/lessons/${lessonId}`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Updated Lesson',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Lesson')
  })

  it('POST /api/courses/:courseId/meetings adds meeting', async () => {
    const res = await request(app).post(`/api/courses/${courseId}/meetings`).set('Authorization', `Bearer ${teacherToken}`).send({
      title: 'Course Meeting', date: '2099-06-15',
    })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Course Meeting')
    meetingId = res.body.id
  })

  it('POST /api/courses/:courseId/toggle-block toggles student block', async () => {
    const res = await request(app).post(`/api/courses/${courseId}/toggle-block/demo-student`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('DELETE /api/courses/:courseId/meetings/:meetingId removes meeting', async () => {
    const res = await request(app).delete(`/api/courses/${courseId}/meetings/${meetingId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('DELETE /api/courses/:courseId/lessons/:lessonId removes lesson', async () => {
    const res = await request(app).delete(`/api/courses/${courseId}/lessons/${lessonId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('DELETE /api/courses/:id deletes course', async () => {
    const res = await request(app).delete(`/api/courses/${courseId}`).set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
