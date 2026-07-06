import { Router } from 'express'
import { SubmissionsService } from './submissions.service.js'
import { SubmissionsController } from './submissions.controller.js'
import { requireAuth } from '../../shared/guards/auth.guard.js'
import { requireTeacher } from '../../shared/guards/roles.guard.js'

export function createSubmissionsModule(): Router {
  const service = new SubmissionsService()
  const controller = new SubmissionsController(service)
  const router = Router()

  router.get('/task/:taskId', requireAuth, controller.getByTask)
  router.get('/student/:studentId', requireAuth, controller.getByStudent)
  router.get('/summary', requireAuth, controller.getSummary)
  router.post('/', requireAuth, controller.upsert)
  router.put('/:id/grade', requireAuth, requireTeacher, controller.setGrade)

  return router
}
