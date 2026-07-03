import { Response, NextFunction } from 'express'
import { AuthService } from './auth.service.js'
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js'

export class AuthController {
  constructor(private service: AuthService) {}

  register = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.register(req.body)
      res.json(result)
    } catch (err) { next(err) }
  }

  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body)
      res.json(result)
    } catch (err) { next(err) }
  }

  getMe = (req: AuthenticatedRequest, res: Response): void => {
    res.json(this.service.getMe(req.user!))
  }

  logout = (req: AuthenticatedRequest, res: Response): void => {
    res.json(this.service.logout(req.token!))
  }

  getSupabaseConfig = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { res.json(this.service.getSupabaseConfig()) }
    catch (err) { next(err) }
  }
}
