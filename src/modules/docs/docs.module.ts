import { Router } from 'express'
import { DocsService } from './docs.service.js'
import { DocsController } from './docs.controller.js'

export function createDocsModule(): Router {
  const service = new DocsService()
  const controller = new DocsController(service)
  const router = Router()

  router.get('/', controller.getHTML)

  return router
}
