import { type Request, type Response } from 'express'
import { AppService } from './app.service.js'

export class AppController {
  constructor(private readonly appService: AppService) {}

  root(_req: Request, res: Response) {
    res.json({ app: this.appService.getAppName(), version: '1.0.0' })
  }
}