import 'dotenv/config'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
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
import { createHealthModule } from './modules/health/health.module.js'

import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { errorHandler } from './shared/filters/http-exception.filter.js'

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

export function createApp(): Express {
  const app = express()

  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
  const PORT = Number.parseInt(process.env.PORT as string, 10) || 3008


  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '1mb' }))

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now()

    const originalJson = res.json.bind(res)
    let responseBody: unknown = null
    res.json = function (body: unknown) {
      responseBody = body
      return originalJson(body)
    }

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt
      const timestamp = formatTimestamp(new Date())
      const statusLabel = formatStatusLabel(res.statusCode)

      if (res.statusCode >= 400) {
        let detail = ''
        if (responseBody) {
          const safe = typeof responseBody === 'object' ? { ...responseBody as Record<string, unknown> } : responseBody
          if (typeof safe === 'object' && safe !== null) delete (safe as any).stack
          detail = ` | ${JSON.stringify(safe)}`
        }
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && typeof req.body === 'object') {
          const sanitized = { ...req.body }
          if (sanitized.password) sanitized.password = '***'
          if (sanitized.password_hash) sanitized.password_hash = '***'
          detail += ` | Body: ${JSON.stringify(sanitized)}`
        }
        console.error(`\n❌ [ERROR] ${timestamp} ${req.method} ${req.originalUrl}`)
        console.error(`   Status: ${res.statusCode} | Duration: ${durationMs}ms${detail}`)
        console.error('')
      } else {
        console.log(`[Nest] ${process.pid} - ${timestamp} ${statusLabel} ${req.method} ${req.originalUrl} ${res.statusCode} +${durationMs}ms`)
      }
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

  const appService = new AppService()
  const appController = new AppController(appService)
  app.get('/api', (req, res) => appController.root(req, res))

  const healthRouter = createHealthModule(); app.use('/api/health', healthRouter)
  const authRouter = createAuthModule(); app.use('/api/auth', authRouter)
  const usersRouter = createUsersModule(); app.use('/api/users', usersRouter)
  const lessonsRouter = createLessonsModule(); app.use('/api/lessons', lessonsRouter)
  const tasksRouter = createTasksModule(); app.use('/api/tasks', tasksRouter)
  const meetingsRouter = createMeetingsModule(); app.use('/api/meetings', meetingsRouter)
  const announcementsRouter = createAnnouncementsModule(); app.use('/api/announcements', announcementsRouter)
  const submissionsRouter = createSubmissionsModule(); app.use('/api/submissions', submissionsRouter)
  const coursesRouter = createCoursesModule(); app.use('/api/courses', coursesRouter)
  const progressRouter = createProgressModule(); app.use('/api/progress', progressRouter)
  const notificationsRouter = createNotificationsModule(); app.use('/api/notifications', notificationsRouter)
  const dbAdminRouter = createDbAdminModule(); app.use('/api/db', dbAdminRouter)
  const docsRouter = createDocsModule(); app.use('/api/docs', docsRouter)

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
  })

  app.use(errorHandler)

  return app
}
