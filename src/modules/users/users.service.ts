import db from '../../database/db.js'

interface UserRow {
  id: string; name: string; username: string; email: string; role: string; created_at: string
}

interface UserCounts {
  total: number; admin: number; teacher: number; student: number
}

interface ProfileUpdate {
  name?: string; username?: string
}

export class UsersService {
  getAll(): UserRow[] {
    return db.prepare('SELECT id, name, username, email, role, created_at FROM users ORDER BY created_at DESC').all() as UserRow[]
  }

  getCounts(): UserCounts {
    const counts = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all() as { role: string; count: number }[]
    const total = counts.reduce((s, c) => s + c.count, 0)
    const admin = counts.find(c => c.role === 'admin')?.count || 0
    const teacher = counts.find(c => c.role === 'teacher')?.count || 0
    const student = counts.find(c => c.role === 'student')?.count || 0
    return { total, admin, teacher, student }
  }

  updateProfile(userId: string, { name, username }: ProfileUpdate): UserRow {
    db.prepare('UPDATE users SET name = COALESCE(?, name), username = COALESCE(?, username) WHERE id = ?')
      .run(name || null, username || null, userId)
    return db.prepare('SELECT id, name, username, email, role FROM users WHERE id = ?').get(userId) as UserRow
  }
}
