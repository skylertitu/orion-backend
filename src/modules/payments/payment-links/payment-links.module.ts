import { Router } from 'express'

import { requireAuth } from '../../../common/guards/auth.guard.js'
import { PaymentLinksController } from './payment-links.controller.js'
import { PaymentLinksService } from './payment-links.service.js'

export function createPaymentLinksModule(): Router {
  const router = Router()
  const service = new PaymentLinksService()
  const controller = new PaymentLinksController(service)

  router.get('/', requireAuth, controller.list)

  return router
}
