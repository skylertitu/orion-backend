import Trade from '../models/Trade';
import { workerLogger } from '../utils/logger';
import { StrategyState } from './StrategyState';

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export class PositionReconciler {
  /**
   * Sincroniza y restaura en memoria las posiciones que figuren con status 'open' en la base de datos.
   */
  async restoreOpenTrades(states: Map<number, StrategyState>): Promise<number> {
    try {
      const openTrades = await Trade.findAll({ where: { status: 'open' } });
      const byStrategy = new Map<number, Trade[]>();

      for (const trade of openTrades) {
        if (!trade.strategyId) continue;
        const list = byStrategy.get(trade.strategyId) || [];
        list.push(trade);
        byStrategy.set(trade.strategyId, list);
      }

      for (const [strategyId, trades] of byStrategy) {
        const primary =
          trades.find((t) => (t.raw as any)?.spreadLeg !== 'hedge') || trades[0];
        const hedge = trades.find((t) => (t.raw as any)?.spreadLeg === 'hedge');

        states.set(strategyId, {
          strategyId,
          inPosition: true,
          side: primary.side,
          entryPrice: Number(primary.entryPrice),
          entryTime: primary.openedAt.getTime(),
          ticket: primary.ticket || undefined,
          tradeId: primary.id,
          quantity: primary.quantity != null ? Number(primary.quantity) : undefined,
          pairSymbol: hedge?.symbol,
          pairSide: hedge?.side,
          pairEntryPrice: hedge ? Number(hedge.entryPrice) : undefined,
          pairTicket: hedge?.ticket || undefined,
          pairTradeId: hedge?.id,
          pairQuantity: hedge?.quantity != null ? Number(hedge.quantity) : undefined,
        });
      }

      if (openTrades.length) {
        workerLogger.info(`[Reconciler] Restauradas ${openTrades.length} posiciones abiertas desde la base de datos`);
      }
      return openTrades.length;
    } catch (err: unknown) {
      workerLogger.error(`[Reconciler] No se pudieron restaurar trades: ${errorText(err)}`);
      return 0;
    }
  }

  /**
   * Limpia estados en memoria para estrategias que han sido desactivadas (si no tienen posición abierta).
   */
  async cleanupClosedStates(states: Map<number, StrategyState>, activeIds: number[]): Promise<void> {
    for (const [id, state] of states) {
      if (activeIds.includes(id)) continue;
      if (state.inPosition) {
        workerLogger.warn(`[Reconciler] Estrategia #${id} inactiva pero con posición abierta; se conserva el estado.`);
        continue;
      }
      states.delete(id);
      workerLogger.info(`[Reconciler] Estado en memoria purgado para estrategia #${id}`);
    }
  }
}

export const positionReconciler = new PositionReconciler();
