import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { TokenPayload, verifyToken } from '../utils/jwt';
import {
  getSystemStatus,
  setModuleEnabled,
  SYSTEM_MODULES,
  SystemModuleId,
} from '../services/systemControl.service';

type AuthRequest = Request & { user?: TokenPayload };

function requestRole(req: Request): string | undefined {
  const existing = (req as AuthRequest).user?.role;
  if (existing) return existing;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return undefined;
  return verifyToken(token)?.role;
}

export const getSystemOverview = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const full = await getSystemStatus();
    if (requestRole(req) === 'admin') {
      response.data = full;
    } else {
      response.data = {
        modules: full.modules.map((mod) => ({
          id: mod.id,
          name: mod.name,
          description: mod.description,
          href: mod.href,
          enabled: mod.enabled,
          health: mod.health,
          label: mod.label,
        })),
      };
    }
    res.json(response);
  } catch (err: unknown) {
    response.success = false;
    response.error = err instanceof Error ? err.message : 'No se pudo leer el estado del sistema';
    res.status(500).json(response);
  }
};

export const toggleSystemModule = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const id = String(req.params.id) as SystemModuleId;
    if (!SYSTEM_MODULES.some((m) => m.id === id)) {
      response.success = false;
      response.error = 'Módulo desconocido';
      return res.status(400).json(response);
    }
    const enabled = req.body?.enabled !== false && req.body?.enabled !== 'false';
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    await setModuleEnabled(id, Boolean(enabled), req.user?.id, note);
    response.data = await getSystemStatus();
    response.message = enabled
      ? `${id} activado para los usuarios`
      : `${id} apagado para los usuarios`;
    res.json(response);
  } catch (err: unknown) {
    response.success = false;
    response.error = err instanceof Error ? err.message : 'No se pudo cambiar el módulo';
    res.status(400).json(response);
  }
};
