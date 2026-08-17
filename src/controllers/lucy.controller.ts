import { Request, Response } from 'express';
import { lucyService } from '../integrations/lucy/lucy.service';
import { LUCY_INTEGRATION } from '../integrations/lucy/lucy.pending';
import { ApiResponse } from '../types';
import { routeParam } from '../utils/params';
import { logger } from '../utils/logger';

function pendingPayload() {
  return {
    pending: true,
    enabled: false,
    reason: LUCY_INTEGRATION.reason,
  };
}

export const analyze = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: false };
  if (LUCY_INTEGRATION.pending) {
    response.error = LUCY_INTEGRATION.reason;
    response.data = pendingPayload();
    return res.status(501).json(response);
  }
  try {
    const result = await lucyService.analyzeChart(_req.body);
    response.success = true;
    response.data = result;
    res.json(response);
  } catch (err: any) {
    logger.error(`[lucy] Error al analizar el gráfico: ${err.message || err}`);
    response.error = 'Error al analizar el gráfico';
    res.status(502).json(response);
  }
};

export const getSignals = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: false };
  if (LUCY_INTEGRATION.pending) {
    response.error = LUCY_INTEGRATION.reason;
    response.data = pendingPayload();
    return res.status(501).json(response);
  }
  try {
    const symbol = routeParam(req.params.symbol);
    const signals = await lucyService.getSignals(symbol);
    response.success = true;
    response.data = signals;
    res.json(response);
  } catch (err: any) {
    logger.error(`[lucy] Error al obtener señales: ${err.message || err}`);
    response.error = 'Error al obtener señales';
    res.status(502).json(response);
  }
};

export const health = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  if (LUCY_INTEGRATION.pending) {
    response.data = { alive: false, ...pendingPayload() };
    return res.json(response);
  }
  try {
    const alive = await lucyService.healthCheck();
    response.data = { alive };
    res.json(response);
  } catch {
    response.success = false;
    response.error = 'Error al verificar servicio Lucy';
    res.status(502).json(response);
  }
};
