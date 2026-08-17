import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import { User } from '../models';

/**
 * Verifica que el usuario autenticado tenga rol 'admin' en la base de datos.
 * Debe usarse DESPUÉS de authMiddleware.
 */
export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const response: ApiResponse = { success: false };
  const tokenUser = (req as Request & { user?: TokenPayload }).user;

  if (!tokenUser) {
    response.error = 'No autenticado';
    return res.status(401).json(response);
  }

  try {
    const dbUser = await User.findByPk(tokenUser.id, { attributes: ['id', 'role'] });
    if (!dbUser || dbUser.role !== 'admin') {
      response.error = 'Acceso denegado. Se requieren permisos de administrador';
      return res.status(403).json(response);
    }
    tokenUser.role = 'admin';
    next();
  } catch {
    response.error = 'Error al verificar permisos';
    return res.status(500).json(response);
  }
};
