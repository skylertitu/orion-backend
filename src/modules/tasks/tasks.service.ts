import db from '../../database/db.js'
import { genId } from '../../lib/id.js'

interface TaskInput { title: string; description?: string; due_date?: string }

export class TasksService {
  getAll(): any[] {
    return db.prepare(`
      SELECT t.*, u.name as teacher_name FROM tasks t
      LEFT JOIN users u ON u.id = t.teacher_id
      ORDER BY t.created_at DESC
    `).all()
  }

  getCount(): number {
    return (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count
  }

  getByTeacher(teacherId: string): any[] {
    return db.prepare('SELECT * FROM tasks WHERE teacher_id = ? ORDER BY created_at DESC').all(teacherId)
  }

  create(teacherId: string, { title, description, due_date }: TaskInput): any {
    const id = genId()
    db.prepare('INSERT INTO tasks (id, teacher_id, title, description, due_date, created_at) VALUES (?,?,?,?,?,?)')
      .run(id, teacherId, title, description, due_date, new Date().toISOString())
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  }

  update(taskId: string, teacherId: string, { title, description, due_date }: TaskInput): any {
    const result = db.prepare('UPDATE tasks SET title = ?, description = ?, due_date = ? WHERE id = ? AND teacher_id = ?')
      .run(title, description, due_date, taskId, teacherId)
    if (result.changes === 0) throw Object.assign(new Error('Tarea no encontrada'), { status: 404, expose: true })
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  }

  delete(taskId: string, teacherId: string): { ok: boolean } {
    db.prepare('DELETE FROM submissions WHERE task_id = ?').run(taskId)
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND teacher_id = ?').run(taskId, teacherId)
    if (result.changes === 0) throw Object.assign(new Error('Tarea no encontrada'), { status: 404, expose: true })
    return { ok: true }
  }
}
