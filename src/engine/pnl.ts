/**
 * Utilidades para cálculo de PnL (ratio y porcentaje) y evaluación de Stop Loss / Take Profit.
 * Compartido entre TradingWorker, TradingEngine y BacktestService para garantizar consistencia.
 */

export type OrderSide = 'buy' | 'sell';
export type RiskTriggerReason = 'stop_loss' | 'take_profit' | null;

/**
 * Calcula el PnL como fracción decimal (ej: +0.02 para +2%, -0.02 para -2%).
 * Usado internamente para persistir en la base de datos (Trade.pnlPct) y para cálculos monetarios en USD.
 */
export function signedPnlRatio(side: OrderSide, entryPrice: number, currentPrice: number): number {
  if (!entryPrice || entryPrice <= 0) return 0;
  const raw = (currentPrice - entryPrice) / entryPrice;
  return side === 'sell' ? -raw : raw;
}

/**
 * Calcula el PnL como porcentaje (ej: +2.0 para +2%, -2.0 para -2%).
 * Usado para comparaciones con configuración del usuario (stop_loss_pct, take_profit_pct).
 */
export function signedPnlPct(side: OrderSide, entryPrice: number, currentPrice: number): number {
  return signedPnlRatio(side, entryPrice, currentPrice) * 100;
}

/**
 * Calcula el PnL de un trade de spread como fracción decimal.
 */
export function spreadPnlRatio(
  side: OrderSide,
  entryPrice: number,
  currentPrice: number,
  qty1 = 0,
  pairSide?: OrderSide,
  pairEntryPrice?: number,
  pairCurrentPrice?: number,
  qty2 = 0
): number {
  const n1 = (qty1 || 0) * (entryPrice || 0);
  const n2 = (qty2 || 0) * (pairEntryPrice || 0);
  const p1 = signedPnlRatio(side, entryPrice, currentPrice) * n1;
  const p2 =
    pairSide && pairEntryPrice && pairCurrentPrice != null
      ? signedPnlRatio(pairSide, pairEntryPrice, pairCurrentPrice) * n2
      : 0;
  const denom = n1 + n2;
  return denom ? (p1 + p2) / denom : 0;
}

/**
 * Calcula el PnL de un trade de spread como porcentaje.
 */
export function spreadPnlPct(
  side: OrderSide,
  entryPrice: number,
  currentPrice: number,
  qty1 = 0,
  pairSide?: OrderSide,
  pairEntryPrice?: number,
  pairCurrentPrice?: number,
  qty2 = 0
): number {
  return (
    spreadPnlRatio(
      side,
      entryPrice,
      currentPrice,
      qty1,
      pairSide,
      pairEntryPrice,
      pairCurrentPrice,
      qty2
    ) * 100
  );
}

/**
 * Evalúa si una posición ha alcanzado su Stop Loss o Take Profit.
 * Ambos parámetros se configuran en porcentaje (ej: stopLossPct = 2 significa -2%).
 *
 * @param pnlPct PnL actual en porcentaje (ej: -2.5 para -2.5%)
 * @param stopLossPct Umbral de Stop Loss en porcentaje (ej: 2 para corte en -2%)
 * @param takeProfitPct Umbral de Take Profit en porcentaje (ej: 4 para toma de ganancias en +4%)
 */
export function evaluateRiskLimits(
  pnlPct: number,
  stopLossPct?: number | null,
  takeProfitPct?: number | null
): RiskTriggerReason {
  if (stopLossPct != null && Number.isFinite(stopLossPct) && stopLossPct !== 0) {
    const sl = Math.abs(stopLossPct);
    if (pnlPct <= -sl) {
      return 'stop_loss';
    }
  }

  if (takeProfitPct != null && Number.isFinite(takeProfitPct) && takeProfitPct !== 0) {
    const tp = Math.abs(takeProfitPct);
    if (pnlPct >= tp) {
      return 'take_profit';
    }
  }

  return null;
}
