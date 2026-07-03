import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { createAuthModule } from './modules/auth/auth.module.js'
import { createUsersModule } from './modules/users/users.module.js'
import { createLessonsModule } from './modules/lessons/lessons.module.js'
import { createTasksModule } from './modules/tasks/tasks.module.js'
import { createMeetingsModule } from './modules/meetings/meetings.module.js'
import { createAnnouncementsModule } from './modules/announcements/announcements.module.js'
import { createSubmissionsModule } from './modules/submissions/submissions.module.js'
import { createCoursesModule } from './modules/courses/courses.module.js'
import { createProgressModule } from './modules/progress/progress.module.js'
import { createNotificationsModule } from './modules/notifications/notifications.module.js'
import { createDbAdminModule } from './modules/db/db.module.js'
import { createDocsModule } from './modules/docs/docs.module.js'

import { errorHandler } from './common/filters/http-exception.filter.js'
import { logModuleRoutes } from './common/utils/log-routes.js'

function formatTimestamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`
}

function formatStatusLabel(statusCode: number): string {
  if (statusCode >= 500) return 'ERROR'
  if (statusCode >= 400) return 'WARN'
  return 'LOG'
}

export function createApp() {
  const app = express()

  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '1mb' }))

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now()

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt
      const timestamp = formatTimestamp(new Date())
      const statusLabel = formatStatusLabel(res.statusCode)
      console.log(`[Nest] ${process.pid} - ${timestamp} ${statusLabel} ${req.method} ${req.originalUrl} ${res.statusCode} +${durationMs}ms`)
    })

    next()
  })

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, intente de nuevo mas tarde' }
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de autenticacion, intente de nuevo mas tarde' }
  })

  app.use('/api', apiLimiter)
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  const authRouter = createAuthModule(); app.use('/api/auth', authRouter); logModuleRoutes(authRouter, '/api/auth')
  const usersRouter = createUsersModule(); app.use('/api/users', usersRouter); logModuleRoutes(usersRouter, '/api/users')
  const lessonsRouter = createLessonsModule(); app.use('/api/lessons', lessonsRouter); logModuleRoutes(lessonsRouter, '/api/lessons')
  const tasksRouter = createTasksModule(); app.use('/api/tasks', tasksRouter); logModuleRoutes(tasksRouter, '/api/tasks')
  const meetingsRouter = createMeetingsModule(); app.use('/api/meetings', meetingsRouter); logModuleRoutes(meetingsRouter, '/api/meetings')
  const announcementsRouter = createAnnouncementsModule(); app.use('/api/announcements', announcementsRouter); logModuleRoutes(announcementsRouter, '/api/announcements')
  const submissionsRouter = createSubmissionsModule(); app.use('/api/submissions', submissionsRouter); logModuleRoutes(submissionsRouter, '/api/submissions')
  const coursesRouter = createCoursesModule(); app.use('/api/courses', coursesRouter); logModuleRoutes(coursesRouter, '/api/courses')
  const progressRouter = createProgressModule(); app.use('/api/progress', progressRouter); logModuleRoutes(progressRouter, '/api/progress')
  const notificationsRouter = createNotificationsModule(); app.use('/api/notifications', notificationsRouter); logModuleRoutes(notificationsRouter, '/api/notifications')
  const dbAdminRouter = createDbAdminModule(); app.use('/api/db', dbAdminRouter); logModuleRoutes(dbAdminRouter, '/api/db')
  const docsRouter = createDocsModule(); app.use('/api/docs', docsRouter); logModuleRoutes(docsRouter, '/api/docs')

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
  })

  app.use(errorHandler)

  return app
}
