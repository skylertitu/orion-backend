import db, { initSchema } from './db.js'
import { hashPassword } from '../lib/password.js'

export default async function seedData(): Promise<void> {
  initSchema()

  const now = new Date().toISOString()

  const adminHash = await hashPassword('admin123')
  const teacherHash = await hashPassword('teacher123')
  const studentHash = await hashPassword('student123')

  const ensureUser = (id: string, name: string, username: string, email: string, passwordHash: string, role: string) => {
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username) as { id: string } | undefined
    if (existingUser) {
      db.prepare('UPDATE users SET name = ?, username = ?, email = ?, password_hash = ?, role = ? WHERE id = ?')
        .run(name, username, email, passwordHash, role, existingUser.id)
      return existingUser.id
    }

    db.prepare('INSERT INTO users (id, name, username, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, username, email, passwordHash, role, now)
    return id
  }

  ensureUser('demo-admin', 'Director General', 'director', 'admin@tradingacademy.com', adminHash, 'admin')
  ensureUser('demo-teacher', 'Prof. Carlos Trader', 'carlos', 'teacher@tradingacademy.com', teacherHash, 'teacher')
  ensureUser('demo-student', 'Ana Estudiante', 'ana', 'student@tradingacademy.com', studentHash, 'student')

  // One-time cleanup of previously seeded demo content
  const demoContent = db.prepare(`
    SELECT SUM(cnt) as total FROM (
      SELECT COUNT(*) as cnt FROM lessons WHERE teacher_id = 'demo-teacher'
      UNION ALL SELECT COUNT(*) FROM tasks WHERE teacher_id = 'demo-teacher'
      UNION ALL SELECT COUNT(*) FROM meetings WHERE teacher_id = 'demo-teacher'
      UNION ALL SELECT COUNT(*) FROM announcements WHERE teacher_id = 'demo-teacher'
      UNION ALL SELECT COUNT(*) FROM courses WHERE teacher_id = 'demo-teacher'
    )
  `).get() as { total: number }
  if (demoContent.total > 0) {
    const demoCourseIds = db.prepare("SELECT id FROM courses WHERE teacher_id = 'demo-teacher'").all() as { id: string }[]
    if (demoCourseIds.length > 0) {
      const ids = demoCourseIds.map(r => r.id)
      const ph = ids.map(() => '?').join(',')
      db.prepare(`DELETE FROM enrollments WHERE course_id IN (${ph})`).run(...ids)
      db.prepare(`DELETE FROM course_lessons WHERE course_id IN (${ph})`).run(...ids)
      db.prepare(`DELETE FROM course_meetings WHERE course_id IN (${ph})`).run(...ids)
      db.prepare(`DELETE FROM course_progress WHERE course_id IN (${ph})`).run(...ids)
      db.prepare(`DELETE FROM courses WHERE teacher_id = 'demo-teacher'`).run()
    }
    // Delete child tables first, then parent tables (FK order)
    db.prepare("DELETE FROM submissions").run()
    db.prepare("DELETE FROM notifications").run()
    db.prepare("DELETE FROM announcements WHERE teacher_id = 'demo-teacher'").run()
    db.prepare("DELETE FROM meetings WHERE teacher_id = 'demo-teacher'").run()
    db.prepare("DELETE FROM tasks WHERE teacher_id = 'demo-teacher'").run()
    db.prepare("DELETE FROM lessons WHERE teacher_id = 'demo-teacher'").run()
  }
}
