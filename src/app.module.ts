import 'dotenv/config'
import express, { Request, Response } from 'express'
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
import { createPaymentsModule } from './modules/payments/payments.module.js'
import { createDbAdminModule } from './modules/db/db.module.js'
import { createDocsModule } from './modules/docs/docs.module.js'

import { errorHandler, notFoundHandler } from './common/filters/http-exception.filter.js'

export function createApp() {
  const app = express()

  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '1mb' }))

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, intente de nuevo más tarde' }
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de autenticación, intente de nuevo más tarde' }
  })

  app.use('/api', apiLimiter)
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/api/auth', createAuthModule())
  app.use('/api/users', createUsersModule())
  app.use('/api/lessons', createLessonsModule())
  app.use('/api/tasks', createTasksModule())
  app.use('/api/meetings', createMeetingsModule())
  app.use('/api/announcements', createAnnouncementsModule())
  app.use('/api/submissions', createSubmissionsModule())
  app.use('/api/courses', createCoursesModule())
  app.use('/api/progress', createProgressModule())
  app.use('/api/notifications', createNotificationsModule())
  app.use('/api/payments', createPaymentsModule())
  app.use('/api/db', createDbAdminModule())
  app.use('/api/docs', createDocsModule())

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
