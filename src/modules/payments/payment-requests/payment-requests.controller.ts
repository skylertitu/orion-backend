import { NextFunction, Response } from 'express'

import { PaymentRequestsService } from './payment-requests.service.js'

export class PaymentRequestsController {
  constructor(private readonly service: PaymentRequestsService) {}

  list = (_req: unknown, res: Response, next: NextFunction): void => {
    try {
      res.json(this.service.list())
    } catch (err) {
      next(err)
    }
  }
}
