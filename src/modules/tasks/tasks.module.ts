import { Router } from 'express'
import { TasksService } from './tasks.service.js'
import { TasksController } from './tasks.controller.js'
import { requireAuth } from '../../shared/guards/auth.guard.js'
import { requireTeacher } from '../../shared/guards/roles.guard.js'

export function createTasksModule(): Router {
  const service = new TasksService()
  const controller = new TasksController(service)
  const router = Router()

  router.get('/', requireAuth, controller.getAll)
  router.get('/count', requireAuth, controller.getCount)
  router.get('/teacher', requireAuth, controller.getByTeacher)
  router.post('/', requireAuth, requireTeacher, controller.create)
  router.put('/:id', requireAuth, requireTeacher, controller.update)
  router.delete('/:id', requireAuth, requireTeacher, controller.delete)

  return router
}
