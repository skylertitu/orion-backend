import { type Request, type Response } from 'express'

export class HealthController {
  check(_req: Request, res: Response) {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  }
}