import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { verifyToken } from '../utils/jwt';
import { User } from '../models';
import { normalizePlan } from '../config/plans';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
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

  try {
    const dbUser = await User.findByPk(payload.id, {
      attributes: ['id', 'role', 'plan', 'sessionVersion', 'email', 'username', 'blocked', 'blockedReason'],
    });
    if (!dbUser) {
      response.error = 'Sesión no válida. Inicia sesión nuevamente';
      return res.status(401).json(response);
    }
    if (dbUser.blocked) {
      response.error = dbUser.blockedReason
        ? `Cuenta bloqueada: ${dbUser.blockedReason}`
        : 'Esta cuenta está bloqueada';
      return res.status(403).json(response);
    }
    if ((payload.sv || 0) !== (dbUser.sessionVersion || 0)) {
      response.error = 'Sesión revocada. Inicia sesión nuevamente';
      return res.status(401).json(response);
    }
    payload.role = dbUser.role;
    payload.plan = normalizePlan(dbUser.role, dbUser.plan);
    payload.email = dbUser.email;
    payload.username = dbUser.username;
    (req as Request & { user?: typeof payload }).user = payload;
    next();
  } catch {
    response.error = 'No se pudo verificar la sesión';
    return res.status(500).json(response);
  }
};
