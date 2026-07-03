import { Response, NextFunction } from 'express'
import { UsersService } from './users.service.js'
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js'

export class UsersController {
  constructor(private service: UsersService) {}

  getAll = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getAll()) }
    catch (err) { next(err) }
  }

  getCounts = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getCounts()) }
    catch (err) { next(err) }
  }

  updateProfile = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.updateProfile(req.user!.id, req.body)) }
    catch (err) { next(err) }
  }
}
