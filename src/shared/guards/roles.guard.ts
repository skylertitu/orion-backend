import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth.guard.js'

export function requireTeacher(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'No tienes permisos para realizar esta acción' })
    return
  }
  next()
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'No tienes permisos para realizar esta acción' })
    return
  }
  next()
}
