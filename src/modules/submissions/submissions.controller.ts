import { Response, NextFunction } from 'express'
import { SubmissionsService } from './submissions.service.js'
import { AuthenticatedRequest } from '../../shared/guards/auth.guard.js'

export class SubmissionsController {
  constructor(private service: SubmissionsService) {}

  getByTask = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getByTask(req.params.taskId as string)) } catch (err) { next(err) }
  }
  getByStudent = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getByStudent(req.params.studentId as string)) } catch (err) { next(err) }
  }
  getSummary = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getSummary()) } catch (err) { next(err) }
  }
  upsert = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.upsert(req.user!.id, req.body)) } catch (err) { next(err) }
  }
  setGrade = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.setGrade(req.params.id as string, req.body)) } catch (err) { next(err) }
  }
}
