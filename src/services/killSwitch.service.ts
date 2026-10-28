import { Op } from 'sequelize';
import Trade from '../models/Trade';
import RiskSettings, { RISK_SETTINGS_ID } from '../models/RiskSettings';
import { pauseByRisk, resumeFromRisk } from './risk.service';
import { tradingEngine } from '../engine/TradingEngine';
import { BrokerId } from '../engine/engine.types';
import { logger, tradeLogger, workerLogger } from '../utils/logger';

export interface KillSwitchActivationInput {
  userId?: number;
  reason?: string;
  closeAllPositions?: boolean;
  activatedBy?: number;
}

export interface KillSwitchStatusResult {
  active: boolean;
  reason: string | null;
  scope: 'global' | 'user';
  closedPositionsCount?: number;
}

/**
 * Activa el Kill Switch de emergencia.
 * Puede pausar globalmente o por usuario específico, y opcionalmente liquidar todas las posiciones abiertas a mercado.
 */
export async function activateKillSwitch(input: KillSwitchActivationInput): Promise<KillSwitchStatusResult> {
  const reason = input.reason?.trim() || 'KILL SWITCH ACTIVADO';
  const targetId = input.userId != null ? `user_${input.userId}` : RISK_SETTINGS_ID;
  const scope = input.userId != null ? 'user' : 'global';

  workerLogger.warn(`[KILL SWITCH] Activado (${scope}): ${reason}`);

  if (scope === 'global') {
    await pauseByRisk(reason, input.activatedBy);
  } else {
    const [row] = await RiskSettings.findOrCreate({
      where: { id: targetId },
      defaults: {
        id: targetId,
        maxDailyLossUsd: 100,
        maxOrderUsd: 50,
        maxOpenPositions: 3,
        maxErrorStreak: 5,
        pausedByRisk: true,
        pauseReason: reason,
        updatedBy: input.activatedBy ?? null,
      },
    });
    await row.update({
      pausedByRisk: true,
      pauseReason: reason,
      updatedBy: input.activatedBy ?? null,
    });
  }

  let closedPositionsCount = 0;

  // Cierre de emergencia de posiciones abiertas si se solicita
  if (input.closeAllPositions) {
    const where: any = { status: 'open' };
    if (input.userId != null) {
      where.userId = input.userId;
    }

    const openTrades = await Trade.findAll({ where });
    workerLogger.warn(`[KILL SWITCH] Cerrando de emergencia ${openTrades.length} posiciones abiertas...`);

    for (const trade of openTrades) {
      try {
        const broker = (trade.broker || 'binance') as BrokerId;
        const closeSide = trade.side === 'buy' ? 'sell' : 'buy';
        const qty = Number(trade.quantity) || 0;

        let result = trade.ticket && !String(trade.ticket).startsWith('SIMULATED-')
          ? await tradingEngine.closePosition(broker, trade.ticket, trade.userId, trade.brokerAccountId ?? undefined)
          : null;

        if (!result?.success && qty > 0) {
          result = await tradingEngine.execute({
            broker,
            symbol: trade.symbol,
            side: closeSide,
            quantity: qty,
            userId: trade.userId,
            brokerAccountId: trade.brokerAccountId ?? undefined,
            clientOrderId: `kill_${trade.id}_${Date.now()}`,
          });
        }

        const exitPrice = result?.executedPrice || Number(trade.entryPrice) || 0;
        await trade.update({
          status: 'closed',
          exitPrice,
          closedAt: new Date(),
          closeReason: 'kill_switch_emergency_close',
        });

        tradeLogger.warn('EMERGENCY_POSITION_CLOSED', {
          tradeId: trade.id,
          ticket: trade.ticket,
          symbol: trade.symbol,
          reason,
        });

        closedPositionsCount++;
      } catch (err) {
        logger.error(`[KILL SWITCH] Error cerrando trade #${trade.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    active: true,
    reason,
    scope,
    closedPositionsCount,
  };
}

/**
 * Desactiva el Kill Switch y restaura la operatividad normal.
 */
export async function deactivateKillSwitch(userId?: number, updatedBy?: number): Promise<KillSwitchStatusResult> {
  const targetId = userId != null ? `user_${userId}` : RISK_SETTINGS_ID;
  const scope = userId != null ? 'user' : 'global';

  if (scope === 'global') {
    await resumeFromRisk(updatedBy);
  } else {
    const row = await RiskSettings.findByPk(targetId);
    if (row) {
      await row.update({
        pausedByRisk: false,
        pauseReason: null,
        updatedBy: updatedBy ?? null,
      });
    }
  }

  workerLogger.info(`[KILL SWITCH] Desactivado (${scope}). Operativa reanudada.`);

  return {
    active: false,
    reason: null,
    scope,
  };
}
