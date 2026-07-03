import { Router } from 'express'
import { NotificationsService } from './notifications.service.js'
import { NotificationsController } from './notifications.controller.js'
import { requireAuth } from '../../common/guards/auth.guard.js'

export function createNotificationsModule(): Router {
  const service = new NotificationsService()
  const controller = new NotificationsController(service)
  const router = Router()

  router.get('/', requireAuth, controller.getAll)
  router.get('/unread-count', requireAuth, controller.getUnreadCount)
  router.put('/:id/read', requireAuth, controller.markRead)
  router.put('/read-all', requireAuth, controller.markAllRead)

  return router
}
