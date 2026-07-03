import { Request, Response, NextFunction } from 'express'
import db from '../../database/db.js'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    name: string
    username: string
    email: string
    role: string
    created_at: string
  }
  token?: string
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  const token = header.slice(7)
  if (!token) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  const session = db.prepare('SELECT user_id, created_at FROM sessions WHERE token = ?').get(token) as { user_id: string; created_at: string } | undefined
  if (!session) {
    res.status(401).json({ error: 'Sesión inválida' })
    return
  }

  const elapsed = Date.now() - new Date(session.created_at).getTime()
  if (elapsed > SESSION_TTL_MS) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    res.status(401).json({ error: 'Sesión expirada' })
    return
  }

  db.prepare('UPDATE sessions SET last_activity_at = ? WHERE token = ?')
    .run(new Date().toISOString(), token)

  const user = db.prepare('SELECT id, name, username, email, role, created_at FROM users WHERE id = ?').get(session.user_id) as {
    id: string; name: string; username: string; email: string; role: string; created_at: string
  } | undefined

  if (!user) {
    res.status(401).json({ error: 'Usuario no encontrado' })
    return
  }

  req.user = user
  req.token = token
  next()
}
