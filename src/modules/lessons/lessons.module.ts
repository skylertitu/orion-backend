import { Router } from 'express'
import { LessonsService } from './lessons.service.js'
import { LessonsController } from './lessons.controller.js'
import { requireAuth } from '../../common/guards/auth.guard.js'
import { requireTeacher } from '../../common/guards/roles.guard.js'

export function createLessonsModule(): Router {
  const service = new LessonsService()
  const controller = new LessonsController(service)
  const router = Router()

  router.get('/', requireAuth, controller.getAll)
  router.get('/count', requireAuth, controller.getCount)
  router.get('/teacher', requireAuth, controller.getByTeacher)
  router.post('/', requireAuth, requireTeacher, controller.create)
  router.put('/:id', requireAuth, requireTeacher, controller.update)
  router.delete('/:id', requireAuth, requireTeacher, controller.delete)

  return router
}
