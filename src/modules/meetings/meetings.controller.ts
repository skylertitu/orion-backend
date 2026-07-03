import { Response, NextFunction } from 'express'
import { MeetingsService } from './meetings.service.js'
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js'

export class MeetingsController {
  constructor(private service: MeetingsService) {}

  getAll = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getAll()) } catch (err) { next(err) }
  }
  getCount = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getCount()) } catch (err) { next(err) }
  }
  getByTeacher = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getByTeacher(req.user!.id)) } catch (err) { next(err) }
  }
  getNext = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getNext()) } catch (err) { next(err) }
  }
  create = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.create(req.user!.id, req.body)) } catch (err) { next(err) }
  }
  update = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.update(req.params.id as string, req.user!.id, req.body)) } catch (err) { next(err) }
  }
  delete = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.delete(req.params.id as string, req.user!.id)) } catch (err) { next(err) }
  }
}
