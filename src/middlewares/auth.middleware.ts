import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { verifyToken } from '../utils/jwt';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const response: ApiResponse = { success: false };
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    response.error = 'Sesión no válida. Inicia sesión nuevamente';
    return res.status(401).json(response);
  }
  const payload = verifyToken(token);
  if (!payload) {
    response.error = 'Sesión expirada. Inicia sesión nuevamente';
    return res.status(401).json(response);
  }
  (req as Request & { user?: typeof payload }).user = payload;
  next();
};
