import db, { initSchema } from './db.js'
import { genId } from '../common/utils/id.js'
import { hashPassword } from '../common/utils/password.js'

export default async function seedData(): Promise<void> {
  initSchema()

  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  const now = new Date().toISOString()
  const teacherId = 'demo-teacher'

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
  ensureUser(teacherId, 'Prof. Carlos Trader', 'carlos', 'teacher@tradingacademy.com', teacherHash, 'teacher')
  ensureUser('demo-student', 'Ana Estudiante', 'ana', 'student@tradingacademy.com', studentHash, 'student')

  if (existing.count > 0) return

  const lessons = [
    { title: 'Introducción al Análisis Técnico', content: 'Fundamentos del análisis técnico, incluyendo soportes, resistencias y tendencias de mercado.' },
    { title: 'Indicadores Técnicos Esenciales', content: 'Estudio detallado de RSI, MACD, Bollinger Bands y medias móviles.' },
    { title: 'Patrones de Velas Japonesas', content: 'Patrones de velas más importantes: doji, martillo, engulfing, estrella fugaz.' }
  ]
  const insLesson = db.prepare('INSERT INTO lessons (id, teacher_id, title, content, date, created_at) VALUES (?,?,?,?,?,?)')
  lessons.forEach((l, i) => {
    insLesson.run(genId(), teacherId, l.title, l.content, new Date(Date.now() + i * 86400000 * 2).toISOString(), now)
  })

  const tasks = [
    { title: 'Identificar Soportes y Resistencias', desc: 'Analiza el gráfico de BTC/USD de las últimas 48 horas.' },
    { title: 'Calcular Risk/Reward', desc: 'Toma 5 setups de trading reales y calcula relación riesgo/recompensa.' }
  ]
  const insTask = db.prepare('INSERT INTO tasks (id, teacher_id, title, description, due_date, created_at) VALUES (?,?,?,?,?,?)')
  tasks.forEach(t => {
    insTask.run(genId(), teacherId, t.title, t.desc, new Date(Date.now() + 86400000 * 7).toISOString(), now)
  })

  const insMeeting = db.prepare('INSERT INTO meetings (id, teacher_id, title, date, time, link, created_at) VALUES (?,?,?,?,?,?,?)')
  insMeeting.run(genId(), teacherId, 'Sesión de Análisis Semanal', new Date(Date.now() + 86400000 * 3).toISOString(), '18:00', 'https://zoom.us/j/9876543210', now)
  insMeeting.run(genId(), teacherId, 'Revisión de Tareas - Grupo A', new Date(Date.now() + 86400000 * 5).toISOString(), '16:30', 'https://meet.google.com/abc-defg-hij', now)

  const insAnn = db.prepare('INSERT INTO announcements (id, teacher_id, content, created_at) VALUES (?,?,?,?)')
  insAnn.run(genId(), teacherId, 'Bienvenidos al nuevo período. Esta semana empezamos con análisis técnico avanzado.', now)
  insAnn.run(genId(), teacherId, 'Recordatorio: La próxima semana no habrá sesión en vivo por feriado.', now)

  const courseId1 = genId()
  const courseId2 = genId()

  const insCourse = db.prepare('INSERT INTO courses (id, teacher_id, title, description, image_url, created_at) VALUES (?,?,?,?,?,?)')
  insCourse.run(courseId1, teacherId, 'Análisis Técnico Avanzado', 'Curso completo de análisis técnico para traders intermedios', null, now)
  insCourse.run(courseId2, teacherId, 'Trading con Indicadores', 'Domina los indicadores técnicos más importantes del mercado', null, now)

  const insCL = db.prepare('INSERT INTO course_lessons (id, course_id, title, content, video_url, order_index, created_at) VALUES (?,?,?,?,?,?,?)')
  insCL.run(genId(), courseId1, 'Introducción al Curso', 'Bienvenido al curso de análisis técnico avanzado.', null, 1, now)
  insCL.run(genId(), courseId1, 'Soportes y Resistencias', 'Aprende a identificar niveles clave.', null, 2, now)
  insCL.run(genId(), courseId2, 'Introducción a Indicadores', 'Visión general de los indicadores técnicos.', null, 1, now)

  const insEnroll = db.prepare('INSERT INTO enrollments (course_id, student_id, student_name, student_email, blocked, enrolled_at) VALUES (?,?,?,?,?,?)')
  insEnroll.run(courseId1, 'demo-student', 'Ana Estudiante', 'student@tradingacademy.com', 0, now)
  insEnroll.run(courseId2, 'demo-student', 'Ana Estudiante', 'student@tradingacademy.com', 0, now)
}
