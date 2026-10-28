import { Op } from 'sequelize';
import RiskSettings, { RISK_SETTINGS_ID } from '../models/RiskSettings';
import Trade from '../models/Trade';
import { getWorkerInstance } from '../engine/workerRegistry';
import { logger, workerLogger } from '../utils/logger';

export type RiskLimits = {
  maxDailyLossUsd: number;
  maxOrderUsd: number;
  maxOpenPositions: number;
  maxErrorStreak: number;
};

export type RiskReject = {
  at: string;
  reason: string;
  symbol?: string;
  strategyId?: number;
};

export type RiskSnapshot = {
  limits: RiskLimits;
  pausedByRisk: boolean;
  pauseReason: string | null;
  errorStreak: number;
  dailyPnlUsd: number;
  openPositions: number;
  lastReject: RiskReject | null;
  updatedBy: number | null;
  updatedAt: string | null;
};

const DEFAULTS: RiskLimits = {
  maxDailyLossUsd: 100,
  maxOrderUsd: 50,
  maxOpenPositions: 3,
  maxErrorStreak: 5,
};

let pausedCache = false;
let errorStreak = 0;
let lastReject: RiskReject | null = null;

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toLimits(row: RiskSettings): RiskLimits {
  return {
    maxDailyLossUsd: num(row.maxDailyLossUsd, DEFAULTS.maxDailyLossUsd),
    maxOrderUsd: num(row.maxOrderUsd, DEFAULTS.maxOrderUsd),
    maxOpenPositions: Math.max(0, Math.floor(num(row.maxOpenPositions, DEFAULTS.maxOpenPositions))),
    maxErrorStreak: Math.max(0, Math.floor(num(row.maxErrorStreak, DEFAULTS.maxErrorStreak))),
  };
}

export function isPausedByRiskSync(): boolean {
  return pausedCache;
}

export async function ensureRiskSettings(): Promise<RiskSettings> {
  const [row] = await RiskSettings.findOrCreate({
    where: { id: RISK_SETTINGS_ID },
    defaults: {
      id: RISK_SETTINGS_ID,
      ...DEFAULTS,
      pausedByRisk: false,
    },
  });
  pausedCache = Boolean(row.pausedByRisk);
  return row;
}

export async function getRiskLimits(): Promise<RiskLimits> {
  const row = await ensureRiskSettings();
  return toLimits(row);
}

export async function updateRiskLimits(patch: Partial<RiskLimits>, updatedBy?: number): Promise<RiskLimits> {
  const row = await ensureRiskSettings();
  const next: RiskLimits = {
    maxDailyLossUsd: patch.maxDailyLossUsd != null ? Math.max(0, num(patch.maxDailyLossUsd, row.maxDailyLossUsd)) : toLimits(row).maxDailyLossUsd,
    maxOrderUsd: patch.maxOrderUsd != null ? Math.max(0, num(patch.maxOrderUsd, row.maxOrderUsd)) : toLimits(row).maxOrderUsd,
    maxOpenPositions: patch.maxOpenPositions != null ? Math.max(0, Math.floor(num(patch.maxOpenPositions, row.maxOpenPositions))) : toLimits(row).maxOpenPositions,
    maxErrorStreak: patch.maxErrorStreak != null ? Math.max(0, Math.floor(num(patch.maxErrorStreak, row.maxErrorStreak))) : toLimits(row).maxErrorStreak,
  };
  await row.update({ ...next, updatedBy: updatedBy ?? row.updatedBy });
  return next;
}

export function calculateRealizedDailyPnl(
  trades: Array<{
    quantity?: number | string | null;
    entryPrice?: number | string | null;
    pnlPct?: number | string | null;
  }>
): number {
  let pnl = 0;
  for (const trade of trades) {
    const qty = Number(trade.quantity) || 0;
    const entry = Number(trade.entryPrice) || 0;
    const pct = Number(trade.pnlPct) || 0;
    pnl += pct * entry * qty;
  }
  return pnl;
}

export async function realizedDailyPnlUsd(userId?: number, brokerAccountId?: number): Promise<number> {
  const where: any = {
    status: 'closed',
    strategyId: { [Op.not]: null },
    closedAt: { [Op.gte]: startOfUtcDay() },
  };
  if (userId != null) {
    where.userId = userId;
  }
  if (brokerAccountId != null) {
    where.brokerAccountId = brokerAccountId;
  }
  const closed = await Trade.findAll({ where });
  return calculateRealizedDailyPnl(closed);
}

export async function openWorkerPositions(userId?: number, brokerAccountId?: number): Promise<number> {
  const where: any = {
    status: 'open',
    strategyId: { [Op.not]: null },
  };
  if (userId != null) {
    where.userId = userId;
  }
  if (brokerAccountId != null) {
    where.brokerAccountId = brokerAccountId;
  }
  return Trade.count({ where });
}

export async function getRiskSnapshot(userId?: number): Promise<RiskSnapshot> {
  const targetId = userId != null ? `user_${userId}` : RISK_SETTINGS_ID;
  const row = (await RiskSettings.findByPk(targetId)) || (await ensureRiskSettings());
  const [dailyPnlUsd, openPositions] = await Promise.all([
    realizedDailyPnlUsd(userId),
    openWorkerPositions(userId),
  ]);
  return {
    limits: toLimits(row),
    pausedByRisk: Boolean(row.pausedByRisk),
    pauseReason: row.pauseReason,
    errorStreak,
    dailyPnlUsd: Math.round(dailyPnlUsd * 100) / 100,
    openPositions,
    lastReject,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export async function pauseByRisk(reason: string, updatedBy?: number): Promise<void> {
  const row = await ensureRiskSettings();
  const text = reason.trim().slice(0, 240) || 'Pausado por motor de riesgo';
  await row.update({
    pausedByRisk: true,
    pauseReason: text,
    updatedBy: updatedBy ?? row.updatedBy,
  });
  pausedCache = true;
  const worker = getWorkerInstance() as { stop?: () => void } | null;
  try {
    worker?.stop?.();
  } catch (err) {
    logger.warn(`[risk] No se pudo detener el worker: ${err instanceof Error ? err.message : err}`);
  }
  workerLogger.warn(`Worker pausado por riesgo: ${text}`);
}

export async function resumeFromRisk(updatedBy?: number): Promise<void> {
  const row = await ensureRiskSettings();
  await row.update({
    pausedByRisk: false,
    pauseReason: null,
    updatedBy: updatedBy ?? row.updatedBy,
  });
  pausedCache = false;
  errorStreak = 0;
  workerLogger.info('Pausa de riesgo levantada');
}

export function evaluateCanOpen(
  limits: RiskLimits,
  current: {
    pausedByRisk: boolean;
    pauseReason?: string | null;
    dailyPnlUsd: number;
    openPositions: number;
  },
  input: {
    notionalUsd: number;
    symbol?: string;
    strategyId?: number;
  }
): { ok: true } | { ok: false; reason: string } {
  if (current.pausedByRisk) {
    return { ok: false, reason: current.pauseReason || 'Worker pausado por riesgo' };
  }

  if (limits.maxDailyLossUsd > 0 && current.dailyPnlUsd <= -limits.maxDailyLossUsd) {
    return {
      ok: false,
      reason: `Pérdida diaria ${current.dailyPnlUsd.toFixed(2)} USD supera el máximo de ${limits.maxDailyLossUsd} USD`,
    };
  }

  if (limits.maxOpenPositions > 0 && current.openPositions >= limits.maxOpenPositions) {
    return {
      ok: false,
      reason: `Hay ${current.openPositions} posiciones abiertas (máximo ${limits.maxOpenPositions})`,
    };
  }

  if (limits.maxOrderUsd > 0 && input.notionalUsd > limits.maxOrderUsd) {
    return {
      ok: false,
      reason: `Orden de ${input.notionalUsd.toFixed(2)} USD supera el tope de ${limits.maxOrderUsd} USD`,
    };
  }

  return { ok: true };
}

export async function assertCanOpen(input: {
  notionalUsd: number;
  symbol?: string;
  strategyId?: number;
  userId?: number;
  brokerAccountId?: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const globalRow = await ensureRiskSettings();
  if (globalRow.pausedByRisk) {
    return { ok: false, reason: globalRow.pauseReason || 'Sistema pausado por riesgo global' };
  }

  // 1. Verificación por usuario
  if (input.userId != null) {
    const userRow = await RiskSettings.findByPk(`user_${input.userId}`);
    if (userRow?.pausedByRisk) {
      return { ok: false, reason: userRow.pauseReason || `Trading pausado por riesgo para el usuario #${input.userId}` };
    }
    const userLimits = userRow ? toLimits(userRow) : toLimits(globalRow);
    const [userDailyPnl, userOpenPositions] = await Promise.all([
      realizedDailyPnlUsd(input.userId, input.brokerAccountId),
      openWorkerPositions(input.userId, input.brokerAccountId),
    ]);

    const userEval = evaluateCanOpen(
      userLimits,
      {
        pausedByRisk: Boolean(userRow?.pausedByRisk),
        pauseReason: userRow?.pauseReason,
        dailyPnlUsd: userDailyPnl,
        openPositions: userOpenPositions,
      },
      input
    );

    if (!userEval.ok) {
      lastReject = {
        at: new Date().toISOString(),
        reason: `[Usuario #${input.userId}] ${userEval.reason}`,
        symbol: input.symbol,
        strategyId: input.strategyId,
      };
      return userEval;
    }
  }

  // 2. Verificación global del sistema
  const globalLimits = toLimits(globalRow);
  const [globalDailyPnl, globalOpenPositions] = await Promise.all([
    realizedDailyPnlUsd(),
    openWorkerPositions(),
  ]);

  const globalEval = evaluateCanOpen(
    globalLimits,
    {
      pausedByRisk: Boolean(globalRow.pausedByRisk),
      pauseReason: globalRow.pauseReason,
      dailyPnlUsd: globalDailyPnl,
      openPositions: globalOpenPositions,
    },
    input
  );

  if (!globalEval.ok) {
    lastReject = {
      at: new Date().toISOString(),
      reason: `[Global] ${globalEval.reason}`,
      symbol: input.symbol,
      strategyId: input.strategyId,
    };
    return globalEval;
  }

  return { ok: true };
}

export async function recordBrokerResult(success: boolean, error?: string): Promise<void> {
  if (success) {
    errorStreak = 0;
    return;
  }
  errorStreak += 1;
  const limits = await getRiskLimits();
  if (limits.maxErrorStreak > 0 && errorStreak >= limits.maxErrorStreak) {
    await pauseByRisk(
      `Racha de ${errorStreak} errores de broker${error ? `: ${error}` : ''}`
    );
  }
}
