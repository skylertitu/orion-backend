import { Response, NextFunction } from 'express'
import { AnnouncementsService } from './announcements.service.js'
import { AuthenticatedRequest } from '../../shared/guards/auth.guard.js'

export class AnnouncementsController {
  constructor(private service: AnnouncementsService) {}

  getAll = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getAll(parseInt(req.query.limit as string) || 0)) }
    catch (err) { next(err) }
  }
  getByTeacher = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getByTeacher(req.user!.id)) } catch (err) { next(err) }
  }
  create = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.create(req.user!.id, req.body)) } catch (err) { next(err) }
  }
  delete = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.delete(req.params.id as string, req.user!.id)) } catch (err) { next(err) }
  }
}
