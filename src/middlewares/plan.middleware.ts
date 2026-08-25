import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import {
  CAPABILITY_DENIED,
  PlanCapability,
  hasCapability,
  normalizePlan,
} from '../config/plans';

type Authed = Request & { user?: TokenPayload };

export async function loadAccess(req: Request): Promise<{
  id: number;
  role: string;
  plan: string | null;
} | null> {
  const tokenUser = (req as Authed).user;
  if (!tokenUser?.id) return null;
  const dbUser = await User.findByPk(tokenUser.id, { attributes: ['id', 'role', 'plan'] });
  if (!dbUser) return null;
  const plan = normalizePlan(dbUser.role, dbUser.plan);
  tokenUser.role = dbUser.role;
  tokenUser.plan = plan;
  return { id: dbUser.id, role: dbUser.role, plan };
}

export function requireCapability(capability: PlanCapability) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const response: ApiResponse = { success: false };
    try {
      const access = await loadAccess(req);
      if (!access) {
        response.error = 'No autenticado';
        return res.status(401).json(response);
      }
      if (!hasCapability(access.role, access.plan, capability)) {
        response.error = CAPABILITY_DENIED[capability] || 'Tu plan no incluye esta función';
        response.data = { capability, plan: access.plan, role: access.role };
        return res.status(403).json(response);
      }
      return next();
    } catch {
      response.error = 'Error al verificar el plan';
      return res.status(500).json(response);
    }
  };
}
