import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isModuleEnabled, SystemModuleId } from '../services/systemControl.service';
import { isStaffRole } from '../utils/roles';
import { ApiResponse } from '../types';

function requestRole(req: Request): string | undefined {
  const existing = (req as Request & { user?: { role?: string } }).user?.role;
  if (existing) return existing;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return undefined;
  return verifyToken(token)?.role;
}

export function requireModule(id: SystemModuleId) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (await isModuleEnabled(id)) return next();
      if (isStaffRole(requestRole(req))) return next();
      const response: ApiResponse = {
        success: false,
        error: 'Este módulo está desactivado temporalmente por administración',
        data: { module: id },
      };
      return res.status(503).json(response);
    } catch {
      const response: ApiResponse = {
        success: false,
        error: 'No se pudo verificar el estado del módulo',
        data: { module: id },
      };
      return res.status(503).json(response);
    }
  };
}
