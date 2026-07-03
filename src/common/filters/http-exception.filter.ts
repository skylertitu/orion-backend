import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  status?: number
  expose?: boolean
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)
  res.status(err.status || 500).json({
    error: err.expose ? err.message : 'Error interno del servidor'
  })
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` })
}
