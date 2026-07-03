import { Response, NextFunction } from 'express'
import { DbAdminService } from './db.service.js'
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js'

export class DbAdminController {
  constructor(private service: DbAdminService) {}

  getTables = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getTables()) } catch (err) { next(err) }
  }
  getTable = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getTable(req.params.name as string)) } catch (err) { next(err) }
  }
  executeQuery = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.executeQuery(req.body.sql)) } catch (err) { next(err) }
  }
}
