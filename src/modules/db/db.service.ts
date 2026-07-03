import db from '../../database/db.js'

const ALLOWED_TABLES = [
  'users', 'lessons', 'tasks', 'meetings', 'announcements',
  'submissions', 'courses', 'course_lessons', 'course_meetings',
  'enrollments', 'course_progress', 'notifications', 'sessions'
]

export class DbAdminService {
  getTables(): string[] {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]
    return tables.map(t => t.name)
  }

  getTable(name: string): any[] {
    if (!ALLOWED_TABLES.includes(name)) {
      throw Object.assign(new Error('Tabla no permitida'), { status: 400, expose: true })
    }
    return db.prepare(`SELECT * FROM [${name}] LIMIT 200`).all()
  }

  executeQuery(sql: string): any[] {
    if (!sql || !/^SELECT\s/i.test(sql.trim())) {
      throw Object.assign(new Error('Solo consultas SELECT permitidas'), { status: 400, expose: true })
    }
    return db.prepare(sql).all()
  }
}
