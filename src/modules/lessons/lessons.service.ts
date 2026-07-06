import db from '../../database/db.js'
import { genId } from '../../lib/id.js'

interface LessonInput { title: string; content?: string; date?: string }
interface LessonRow { id: string; teacher_id: string; title: string; content?: string; date?: string; created_at: string }

export class LessonsService {
  getAll(): any[] {
    return db.prepare(`
      SELECT l.*, u.name as teacher_name FROM lessons l
      LEFT JOIN users u ON u.id = l.teacher_id
      ORDER BY l.date DESC
    `).all()
  }

  getCount(): number {
    return (db.prepare('SELECT COUNT(*) as count FROM lessons').get() as { count: number }).count
  }

  getByTeacher(teacherId: string): LessonRow[] {
    return db.prepare('SELECT * FROM lessons WHERE teacher_id = ? ORDER BY date DESC').all(teacherId) as LessonRow[]
  }

  create(teacherId: string, { title, content, date }: LessonInput): LessonRow {
    const id = genId()
    db.prepare('INSERT INTO lessons (id, teacher_id, title, content, date, created_at) VALUES (?,?,?,?,?,?)')
      .run(id, teacherId, title, content, date, new Date().toISOString())
    return db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) as LessonRow
  }

  update(lessonId: string, teacherId: string, { title, content, date }: LessonInput): LessonRow {
    const result = db.prepare('UPDATE lessons SET title = ?, content = ?, date = ? WHERE id = ? AND teacher_id = ?')
      .run(title, content, date, lessonId, teacherId)
    if (result.changes === 0) {
      throw Object.assign(new Error('Lección no encontrada'), { status: 404, expose: true })
    }
    return db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId) as LessonRow
  }

  delete(lessonId: string, teacherId: string): { ok: boolean } {
    const result = db.prepare('DELETE FROM lessons WHERE id = ? AND teacher_id = ?').run(lessonId, teacherId)
    if (result.changes === 0) {
      throw Object.assign(new Error('Lección no encontrada'), { status: 404, expose: true })
    }
    return { ok: true }
  }
}
