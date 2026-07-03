import { Response, NextFunction } from 'express'
import { NotificationsService } from './notifications.service.js'
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js'

export class NotificationsController {
  constructor(private service: NotificationsService) {}

  getAll = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getAll(req.user!.id)) } catch (err) { next(err) }
  }
  getUnreadCount = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getUnreadCount(req.user!.id)) } catch (err) { next(err) }
  }
  markRead = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.markRead(req.params.id as string)) } catch (err) { next(err) }
  }
  markAllRead = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.markAllRead(req.user!.id)) } catch (err) { next(err) }
  }
}
