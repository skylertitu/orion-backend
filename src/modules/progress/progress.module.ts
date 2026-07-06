import { Router } from 'express'
import { ProgressService } from './progress.service.js'
import { ProgressController } from './progress.controller.js'
import { requireAuth } from '../../shared/guards/auth.guard.js'

export function createProgressModule(): Router {
  const service = new ProgressService()
  const controller = new ProgressController(service)
  const router = Router()

  router.put('/:courseId/:lessonId', requireAuth, controller.upsert)
  router.get('/:courseId', requireAuth, controller.getByCourse)

  return router
}
