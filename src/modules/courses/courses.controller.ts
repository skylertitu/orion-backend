import { Response, NextFunction } from 'express'
import { CoursesService } from './courses.service.js'
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js'

export class CoursesController {
  constructor(private service: CoursesService) {}

  getAll = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getAll()) } catch (err) { next(err) }
  }
  getByTeacher = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getByTeacher(req.user!.id)) } catch (err) { next(err) }
  }
  getByStudent = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getByStudent(req.params.studentId as string)) } catch (err) { next(err) }
  }
  getById = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getById(req.params.id as string)) } catch (err) { next(err) }
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
  addLesson = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.addLesson(req.params.courseId as string, req.body)) } catch (err) { next(err) }
  }
  updateLesson = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.updateLesson(req.params.lessonId as string, req.body)) } catch (err) { next(err) }
  }
  removeLesson = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.removeLesson(req.params.lessonId as string)) } catch (err) { next(err) }
  }
  addMeeting = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.addMeeting(req.params.courseId as string, req.body)) } catch (err) { next(err) }
  }
  removeMeeting = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.removeMeeting(req.params.meetingId as string)) } catch (err) { next(err) }
  }
  enroll = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.enroll(req.params.courseId as string, req.user!)) } catch (err) { next(err) }
  }
  toggleBlock = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.toggleBlock(req.params.courseId as string, req.params.studentId as string)) } catch (err) { next(err) }
  }
}
