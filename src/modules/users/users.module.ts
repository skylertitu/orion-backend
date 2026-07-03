import { Router } from 'express'
import { UsersService } from './users.service.js'
import { UsersController } from './users.controller.js'
import { requireAuth } from '../../common/guards/auth.guard.js'

export function createUsersModule(): Router {
  const service = new UsersService()
  const controller = new UsersController(service)
  const router = Router()

  router.get('/', requireAuth, controller.getAll)
  router.get('/counts', requireAuth, controller.getCounts)
  router.put('/profile', requireAuth, controller.updateProfile)

  return router
}
