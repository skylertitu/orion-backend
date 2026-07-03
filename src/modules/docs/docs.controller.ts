import { Request, Response } from 'express'
import { DocsService } from './docs.service.js'

export class DocsController {
  constructor(private service: DocsService) {}

  getHTML = (req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(this.service.getHTML())
  }
}
