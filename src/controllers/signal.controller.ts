import { Request, Response } from 'express';
import { signalService } from '../services/signal.service';
import { ApiResponse } from '../types';
import { loadAccess } from '../middlewares/plan.middleware';

export const getUserSignals = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = Number(req.params.userId);
    const access = await loadAccess(req);
    if (!access) {
      response.success = false;
      response.error = 'No autenticado';
      return res.status(401).json(response);
    }
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const source = req.query.source as string | undefined;

    if (source === 'lucy') {
      if (!signalService.canReadLucyFeed(access.role, access.plan)) {
        response.success = false;
        response.error = 'Las señales de Lucy van en el plan Señales';
        return res.status(403).json(response);
      }
      response.data = await signalService.getLucyFeed(limit);
      return res.json(response);
    }

    if (access.id !== userId) {
      response.success = false;
      response.error = 'No autorizado';
      return res.status(403).json(response);
    }
    response.data = await signalService.getUserSignals(userId, limit, source);
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al obtener señales';
    res.status(400).json(response);
  }
};
