import { Request, Response } from 'express';
import { signalService } from '../services/signal.service';
import { ApiResponse } from '../types';

export const getUserSignals = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = Number(req.params.userId);
    const tokenUser = (req as any).user;
    if (tokenUser.id !== userId) {
      response.success = false;
      response.error = 'No autorizado';
      return res.status(403).json(response);
    }
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const source = req.query.source as string | undefined;
    response.data = await signalService.getUserSignals(userId, limit, source);
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al obtener señales';
    res.status(400).json(response);
  }
};
