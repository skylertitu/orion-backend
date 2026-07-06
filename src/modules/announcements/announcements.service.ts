import db from '../../database/db.js'
import { genId } from '../../lib/id.js'

export class AnnouncementsService {
  getAll(limit: number): any[] {
    let q = db.prepare(`
      SELECT a.*, u.name as teacher_name FROM announcements a
      LEFT JOIN users u ON u.id = a.teacher_id
      ORDER BY a.created_at DESC
    `).all()
    if (limit > 0) q = q.slice(0, limit)
    return q
  }

  getByTeacher(teacherId: string): any[] {
    return db.prepare('SELECT * FROM announcements WHERE teacher_id = ? ORDER BY created_at DESC').all(teacherId)
  }

  create(teacherId: string, { content }: { content: string }): any {
    const id = genId()
    db.prepare('INSERT INTO announcements (id, teacher_id, content, created_at) VALUES (?,?,?,?)')
      .run(id, teacherId, content, new Date().toISOString())
    return db.prepare('SELECT * FROM announcements WHERE id = ?').get(id)
  }

  delete(announcementId: string, teacherId: string): { ok: boolean } {
    const result = db.prepare('DELETE FROM announcements WHERE id = ? AND teacher_id = ?').run(announcementId, teacherId)
    if (result.changes === 0) throw Object.assign(new Error('Anuncio no encontrado'), { status: 404, expose: true })
    return { ok: true }
  }
}
