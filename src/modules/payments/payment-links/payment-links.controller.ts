import { NextFunction, Response } from 'express'

import { PaymentLinksService } from './payment-links.service.js'

export class PaymentLinksController {
  constructor(private readonly service: PaymentLinksService) {}

  list = (_req: unknown, res: Response, next: NextFunction): void => {
    try {
      res.json(this.service.listPaymentLinks())
    } catch (err) {
      next(err)
    }
  }
}
