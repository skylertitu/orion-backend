import { Router } from 'express'

import { requireAuth } from '../../../common/guards/auth.guard.js'
import { PaymentRequestsController } from './payment-requests.controller.js'
import { PaymentRequestsService } from './payment-requests.service.js'

export function createPaymentRequestsModule(): Router {
  const router = Router()
  const service = new PaymentRequestsService()
  const controller = new PaymentRequestsController(service)

  router.get('/', requireAuth, controller.list)

  return router
}
