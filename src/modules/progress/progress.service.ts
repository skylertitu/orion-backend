import db from '../../database/db.js'
import { genId } from '../../lib/id.js'

export class ProgressService {
  upsert(studentId: string, courseId: string, lessonId: string, { completed }: { completed?: boolean }): any[] {
    const existing = db.prepare('SELECT id FROM course_progress WHERE student_id = ? AND course_id = ? AND lesson_id = ?')
      .get(studentId, courseId, lessonId) as { id: string } | undefined
    const now = new Date().toISOString()
    if (existing) {
      db.prepare('UPDATE course_progress SET completed = ?, completed_at = ? WHERE id = ?').run(completed ? 1 : 0, now, existing.id)
    } else {
      const id = genId()
      db.prepare('INSERT INTO course_progress (id, student_id, course_id, lesson_id, completed, completed_at) VALUES (?,?,?,?,?,?)')
        .run(id, studentId, courseId, lessonId, completed ? 1 : 0, now)
    }
    return db.prepare('SELECT * FROM course_progress WHERE student_id = ? AND course_id = ?').all(studentId, courseId)
  }

  getByCourse(studentId: string, courseId: string): any[] {
    return db.prepare('SELECT * FROM course_progress WHERE student_id = ? AND course_id = ?').all(studentId, courseId)
  }
}
