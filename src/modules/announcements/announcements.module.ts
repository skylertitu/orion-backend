import { Router } from 'express'
import { AnnouncementsService } from './announcements.service.js'
import { AnnouncementsController } from './announcements.controller.js'
import { requireAuth } from '../../shared/guards/auth.guard.js'
import { requireTeacher } from '../../shared/guards/roles.guard.js'

export function createAnnouncementsModule(): Router {
  const service = new AnnouncementsService()
  const controller = new AnnouncementsController(service)
  const router = Router()

  router.get('/', requireAuth, controller.getAll)
  router.get('/teacher', requireAuth, controller.getByTeacher)
  router.post('/', requireAuth, requireTeacher, controller.create)
  router.delete('/:id', requireAuth, requireTeacher, controller.delete)

  return router
}
