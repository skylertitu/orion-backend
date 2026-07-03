import { Response, NextFunction } from 'express'
import { ProgressService } from './progress.service.js'
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js'

export class ProgressController {
  constructor(private service: ProgressService) {}

  upsert = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.upsert(req.user!.id, req.params.courseId as string, req.params.lessonId as string, req.body)) }
    catch (err) { next(err) }
  }
  getByCourse = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getByCourse(req.user!.id, req.params.courseId as string)) }
    catch (err) { next(err) }
  }
}
