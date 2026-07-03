import { Router } from 'express'
import { DbAdminService } from './db.service.js'
import { DbAdminController } from './db.controller.js'
import { requireAuth } from '../../common/guards/auth.guard.js'
import { requireAdmin } from '../../common/guards/roles.guard.js'

export function createDbAdminModule(): Router {
  const service = new DbAdminService()
  const controller = new DbAdminController(service)
  const router = Router()

  router.get('/tables', requireAuth, requireAdmin, controller.getTables)
  router.get('/table/:name', requireAuth, requireAdmin, controller.getTable)
  router.post('/query', requireAuth, requireAdmin, controller.executeQuery)

  return router
}
