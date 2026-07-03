import { Router } from 'express'
import { MeetingsService } from './meetings.service.js'
import { MeetingsController } from './meetings.controller.js'
import { requireAuth } from '../../common/guards/auth.guard.js'
import { requireTeacher } from '../../common/guards/roles.guard.js'

export function createMeetingsModule(): Router {
  const service = new MeetingsService()
  const controller = new MeetingsController(service)
  const router = Router()

  router.get('/', requireAuth, controller.getAll)
  router.get('/count', requireAuth, controller.getCount)
  router.get('/teacher', requireAuth, controller.getByTeacher)
  router.get('/next', requireAuth, controller.getNext)
  router.post('/', requireAuth, requireTeacher, controller.create)
  router.put('/:id', requireAuth, requireTeacher, controller.update)
  router.delete('/:id', requireAuth, requireTeacher, controller.delete)

  return router
}
