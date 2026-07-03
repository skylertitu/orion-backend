import { Router } from 'express'

import { createPaymentLinksModule } from './payment-links/payment-links.module.js'
import { createPaymentRequestsModule } from './payment-requests/payment-requests.module.js'

export function createPaymentsModule(): Router {
  const router = Router()

  router.use('/payment-links', createPaymentLinksModule())
  router.use('/payment-requests', createPaymentRequestsModule())

  return router
}
