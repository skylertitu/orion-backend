import { Router } from 'express'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { requireAuth } from '../../shared/guards/auth.guard.js'
import { registerValidation, loginValidation } from '../../shared/pipes/validation.pipe.js'

export function createAuthModule(): Router {
  const service = new AuthService()
  const controller = new AuthController(service)
  const router = Router()

  router.post('/register', registerValidation, controller.register)
  router.post('/login', loginValidation, controller.login)
  router.get('/me', requireAuth, controller.getMe)
  router.post('/logout', requireAuth, controller.logout)


  return router
}
