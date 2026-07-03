import db from '../../database/db.js'
import { genId } from '../../common/utils/id.js'
import { mapKeys } from '../../common/utils/camelcase.js'

interface MeetingInput { title: string; date?: string; time?: string; link?: string; isLiveClass?: boolean; platform?: string }

export class MeetingsService {
  getAll(): any[] {
    return mapKeys(db.prepare(`
      SELECT m.*, u.name as teacher_name FROM meetings m
      LEFT JOIN users u ON u.id = m.teacher_id
      ORDER BY m.date ASC
    `).all())
  }

  getCount(): number {
    return (db.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }).count
  }

  getByTeacher(teacherId: string): any[] {
    return mapKeys(db.prepare('SELECT * FROM meetings WHERE teacher_id = ? ORDER BY date ASC').all(teacherId))
  }

  getNext(): any {
    const now = new Date().toISOString()
    const m = db.prepare("SELECT * FROM meetings WHERE date > ? ORDER BY date ASC LIMIT 1").get(now) as any
    return m ? mapKeys(m) : null
  }

  create(teacherId: string, { title, date, time, link, isLiveClass, platform }: MeetingInput): any {
    const id = genId()
    db.prepare('INSERT INTO meetings (id, teacher_id, title, date, time, link, is_live_class, platform, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, teacherId, title, date, time, link, isLiveClass ? 1 : 0, platform || null, new Date().toISOString())
    return mapKeys(db.prepare('SELECT * FROM meetings WHERE id = ?').get(id))
  }

  update(meetingId: string, teacherId: string, { title, date, time, link }: Partial<MeetingInput>): any {
    const result = db.prepare('UPDATE meetings SET title = ?, date = ?, time = ?, link = ? WHERE id = ? AND teacher_id = ?')
      .run(title, date, time, link, meetingId, teacherId)
    if (result.changes === 0) throw Object.assign(new Error('Reunión no encontrada'), { status: 404, expose: true })
    return mapKeys(db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId))
  }

  delete(meetingId: string, teacherId: string): { ok: boolean } {
    const result = db.prepare('DELETE FROM meetings WHERE id = ? AND teacher_id = ?').run(meetingId, teacherId)
    if (result.changes === 0) throw Object.assign(new Error('Reunión no encontrada'), { status: 404, expose: true })
    return { ok: true }
  }
}
