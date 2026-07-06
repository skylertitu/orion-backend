import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  status?: number
  expose?: boolean
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || 500
  const timestamp = new Date().toLocaleString('es-ES')
  console.error(`\n❌ [ERROR] ${timestamp} ${req.method} ${req.originalUrl}`)
  console.error(`   Status: ${status} | Mensaje: ${err.message}`)
  if (status >= 500) console.error(`   Stack: ${err.stack}`)
  console.error('')
  res.status(status).json({
    error: err.expose ? err.message : 'Error interno del servidor'
  })
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` })
}
