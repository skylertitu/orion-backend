import { Router } from 'express'
import { HealthController } from './health.controller.js'

export function createHealthModule(): Router {
  const controller = new HealthController()
  const router = Router()
  router.get('/', controller.check)
  return router
}