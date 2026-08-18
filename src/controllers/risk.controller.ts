import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import {
  getRiskSnapshot,
  updateRiskLimits,
  pauseByRisk,
  resumeFromRisk,
} from '../services/risk.service';
import { getSystemStatus, isModuleEnabled } from '../services/systemControl.service';
import { getWorkerInstance } from '../engine/workerRegistry';

type AuthRequest = Request & { user?: TokenPayload };

function fail(err: unknown): string {
  return err instanceof Error ? err.message : 'Error en motor de riesgo';
}

export const getRisk = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    response.data = await getRiskSnapshot();
    res.json(response);
  } catch (err: unknown) {
    response.success = false;
    response.error = fail(err);
    res.status(500).json(response);
  }
};

export const saveRisk = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    await updateRiskLimits(
      {
        maxDailyLossUsd: req.body?.maxDailyLossUsd,
        maxOrderUsd: req.body?.maxOrderUsd,
        maxOpenPositions: req.body?.maxOpenPositions,
        maxErrorStreak: req.body?.maxErrorStreak,
      },
      req.user?.id
    );
    response.data = await getSystemStatus();
    response.message = 'Límites de riesgo guardados';
    res.json(response);
  } catch (err: unknown) {
    response.success = false;
    response.error = fail(err);
    res.status(400).json(response);
  }
};

export const pauseRisk = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Pausa manual desde Control';
    await pauseByRisk(reason, req.user?.id);
    response.data = await getSystemStatus();
    response.message = 'Worker pausado por riesgo';
    res.json(response);
  } catch (err: unknown) {
    response.success = false;
    response.error = fail(err);
    res.status(400).json(response);
  }
};

export const resumeRisk = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    await resumeFromRisk(req.user?.id);
    const worker = getWorkerInstance() as { start?: () => void } | null;
    if (process.env.WORKER_ENABLED !== 'false' && (await isModuleEnabled('worker'))) {
      worker?.start?.();
    }
    response.data = await getSystemStatus();
    response.message = 'Worker reanudado';
    res.json(response);
  } catch (err: unknown) {
    response.success = false;
    response.error = fail(err);
    res.status(400).json(response);
  }
};
