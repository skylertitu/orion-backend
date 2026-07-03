import db from '../../database/db.js'
import { genId } from '../../common/utils/id.js'
import { mapKeys } from '../../common/utils/camelcase.js'

interface CourseInput { title: string; description?: string; image_url?: string }
interface LessonInput { title: string; content?: string; video_url?: string }
interface MeetingInput { title: string; date?: string; time?: string; platform?: string; link?: string }

function populate(c: any): any {
  if (!c) return null
  c.lessons = mapKeys(db.prepare('SELECT * FROM course_lessons WHERE course_id = ? ORDER BY order_index').all(c.id))
  c.meetings = mapKeys(db.prepare('SELECT * FROM course_meetings WHERE course_id = ?').all(c.id))
  c.students = db.prepare(`
    SELECT e.student_id AS studentId, u.name AS studentName,
           e.student_email AS studentEmail, e.blocked,
           e.enrolled_at AS enrolledAt
    FROM enrollments e
    LEFT JOIN users u ON u.id = e.student_id
    WHERE e.course_id = ?
  `).all(c.id)
  return c
}

export class CoursesService {
  getAll(): any[] {
    const courses = db.prepare(`
      SELECT c.*, u.name as teacher_name FROM courses c
      LEFT JOIN users u ON u.id = c.teacher_id
      ORDER BY c.created_at DESC
    `).all() as any[]
    for (const c of courses) populate(c)
    return courses
  }

  getByTeacher(teacherId: string): any[] {
    const courses = db.prepare('SELECT * FROM courses WHERE teacher_id = ? ORDER BY created_at DESC').all(teacherId) as any[]
    for (const c of courses) populate(c)
    return courses
  }

  getByStudent(studentId: string): any[] {
    const enrollments = db.prepare('SELECT course_id FROM enrollments WHERE student_id = ?').all(studentId) as { course_id: string }[]
    const ids = enrollments.map(e => e.course_id)
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    const courses = db.prepare(`SELECT * FROM courses WHERE id IN (${placeholders})`).all(...ids) as any[]
    for (const c of courses) populate(c)
    return courses
  }

  getById(courseId: string): any {
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any
    if (!c) throw Object.assign(new Error('Curso no encontrado'), { status: 404, expose: true })
    return populate(c)
  }

  create(teacherId: string, { title, description, image_url }: CourseInput): any {
    const id = genId()
    db.prepare('INSERT INTO courses (id, teacher_id, title, description, image_url, created_at) VALUES (?,?,?,?,?,?)')
      .run(id, teacherId, title, description, image_url, new Date().toISOString())
    return mapKeys(db.prepare('SELECT * FROM courses WHERE id = ?').get(id))
  }

  update(courseId: string, teacherId: string, { title, description, image_url }: CourseInput): any {
    const result = db.prepare('UPDATE courses SET title = COALESCE(?, title), description = COALESCE(?, description), image_url = COALESCE(?, image_url) WHERE id = ? AND teacher_id = ?')
      .run(title || null, description || null, image_url || null, courseId, teacherId)
    if (result.changes === 0) throw Object.assign(new Error('Curso no encontrado'), { status: 404, expose: true })
    return mapKeys(db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId))
  }

  delete(courseId: string, teacherId: string): { ok: boolean } {
    const result = db.prepare('DELETE FROM courses WHERE id = ? AND teacher_id = ?').run(courseId, teacherId)
    if (result.changes === 0) throw Object.assign(new Error('Curso no encontrado'), { status: 404, expose: true })
    db.prepare('DELETE FROM course_lessons WHERE course_id = ?').run(courseId)
    db.prepare('DELETE FROM course_meetings WHERE course_id = ?').run(courseId)
    db.prepare('DELETE FROM enrollments WHERE course_id = ?').run(courseId)
    db.prepare('DELETE FROM course_progress WHERE course_id = ?').run(courseId)
    return { ok: true }
  }

  addLesson(courseId: string, { title, content, video_url }: LessonInput): any {
    const id = genId()
    const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), 0) + 1 as next FROM course_lessons WHERE course_id = ?').get(courseId) as { next: number }
    db.prepare('INSERT INTO course_lessons (id, course_id, title, content, video_url, order_index, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, courseId, title, content, video_url, maxOrder.next, new Date().toISOString())
    return mapKeys(db.prepare('SELECT * FROM course_lessons WHERE id = ?').get(id))
  }

  updateLesson(lessonId: string, { title, content, video_url }: LessonInput): any {
    const result = db.prepare('UPDATE course_lessons SET title = COALESCE(?, title), content = COALESCE(?, content), video_url = COALESCE(?, video_url) WHERE id = ?')
      .run(title || null, content || null, video_url || null, lessonId)
    if (result.changes === 0) throw Object.assign(new Error('Lección no encontrada'), { status: 404, expose: true })
    return mapKeys(db.prepare('SELECT * FROM course_lessons WHERE id = ?').get(lessonId))
  }

  removeLesson(lessonId: string): { ok: boolean } {
    db.prepare('DELETE FROM course_lessons WHERE id = ?').run(lessonId)
    db.prepare('DELETE FROM course_progress WHERE lesson_id = ?').run(lessonId)
    return { ok: true }
  }

  addMeeting(courseId: string, { title, date, time, platform, link }: MeetingInput): any {
    const id = genId()
    db.prepare('INSERT INTO course_meetings (id, course_id, title, date, time, platform, link, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, courseId, title, date, time, platform, link, new Date().toISOString())
    return mapKeys(db.prepare('SELECT * FROM course_meetings WHERE id = ?').get(id))
  }

  removeMeeting(meetingId: string): { ok: boolean } {
    db.prepare('DELETE FROM course_meetings WHERE id = ?').run(meetingId)
    return { ok: true }
  }

  enroll(courseId: string, user: { id: string; name: string; email: string }): { ok: boolean } {
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId)
    if (!c) throw Object.assign(new Error('Curso no encontrado'), { status: 404, expose: true })
    const existing = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND student_id = ?').get(courseId, user.id)
    if (existing) throw Object.assign(new Error('Ya estás inscrito en este curso'), { status: 400, expose: true })
    db.prepare('INSERT INTO enrollments (course_id, student_id, student_name, student_email, blocked, enrolled_at) VALUES (?,?,?,?,?,?)')
      .run(courseId, user.id, user.name, user.email, 0, new Date().toISOString())
    return { ok: true }
  }

  toggleBlock(courseId: string, studentId: string): { ok: boolean } {
    const e = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND student_id = ?').get(courseId, studentId) as { blocked: number } | undefined
    if (!e) throw Object.assign(new Error('Inscripción no encontrada'), { status: 404, expose: true })
    db.prepare('UPDATE enrollments SET blocked = ? WHERE course_id = ? AND student_id = ?')
      .run(e.blocked ? 0 : 1, courseId, studentId)
    return { ok: true }
  }
}
