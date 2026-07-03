import db from '../../database/db.js'
import { genId } from '../../common/utils/id.js'

export class SubmissionsService {
  getByTask(taskId: string): any[] {
    return db.prepare(`
      SELECT s.*, u.name as student_name FROM submissions s
      LEFT JOIN users u ON u.id = s.student_id
      WHERE s.task_id = ?
    `).all(taskId)
  }

  getByStudent(studentId: string): any[] {
    return db.prepare('SELECT * FROM submissions WHERE student_id = ?').all(studentId)
  }

  getSummary(): any[] {
    return db.prepare('SELECT id, task_id, grade FROM submissions').all()
  }

  upsert(studentId: string, { task_id, content }: { task_id: string; content?: string }): any {
    const existing = db.prepare('SELECT id FROM submissions WHERE task_id = ? AND student_id = ?').get(task_id, studentId) as { id: string } | undefined
    const now = new Date().toISOString()
    if (existing) {
      db.prepare('UPDATE submissions SET content = ?, submitted_at = ? WHERE id = ?').run(content, now, existing.id)
      return db.prepare('SELECT * FROM submissions WHERE id = ?').get(existing.id)
    }
    const id = genId()
    db.prepare('INSERT INTO submissions (id, task_id, student_id, content, submitted_at) VALUES (?,?,?,?,?)')
      .run(id, task_id, studentId, content, now)
    return db.prepare('SELECT * FROM submissions WHERE id = ?').get(id)
  }

  setGrade(submissionId: string, { grade }: { grade?: number }): any {
    const result = db.prepare('UPDATE submissions SET grade = ? WHERE id = ?').run(grade, submissionId)
    if (result.changes === 0) throw Object.assign(new Error('Entrega no encontrada'), { status: 404, expose: true })
    return db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId)
  }
}
