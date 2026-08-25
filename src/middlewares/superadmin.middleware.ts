import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import { User } from '../models';
import { isSuperAdminRole } from '../utils/roles';

/**
 * Superadmin: control total de usuarios y datos. Bloquear, roles, borrar, editar.
 */
export const superadminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const response: ApiResponse = { success: false };
  const tokenUser = (req as Request & { user?: TokenPayload }).user;

  if (!tokenUser) {
    response.error = 'No autenticado';
    return res.status(401).json(response);
  }

  try {
    const dbUser = await User.findByPk(tokenUser.id, { attributes: ['id', 'role'] });
    if (!dbUser || !isSuperAdminRole(dbUser.role)) {
      response.error = 'Acceso denegado. Se requiere rol superadmin';
      return res.status(403).json(response);
    }
    tokenUser.role = 'superadmin';
    next();
  } catch {
    response.error = 'Error al verificar permisos';
    return res.status(500).json(response);
  }
};
