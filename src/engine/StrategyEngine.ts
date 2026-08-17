import { WsKline } from '../services/binanceWs';
import { workerLogger } from '../utils/logger';

// ── Indicadores (replicados del frontend para correr en server) ──

export function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(0); continue; }
    if (i === period - 1) {
      ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}

export function calcSMA(closes: number[], period: number): number[] {
  return closes.map((_, i) => {
    if (i < period - 1) return 0;
    return closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

export function calcRSI(closes: number[], period: number): number[] {
  const result: number[] = [0];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i < period) { avgGain += gain; avgLoss += loss; result.push(0); continue; }
    if (i === period) {
      avgGain = (avgGain + gain) / period;
      avgLoss = (avgLoss + loss) / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

export function calcMACD(closes: number[], fast: number, slow: number, signal: number) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = emaFast.map((f, i) => f && emaSlow[i] ? f - emaSlow[i] : 0);
  const validMacd = macdLine.filter((v) => v !== 0);
  const signalEma = calcEMA(validMacd, signal);
  let idx = 0;
  const signalLine = macdLine.map((m) => m === 0 ? 0 : signalEma[idx++] ?? 0);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

// ── Tipos del motor ──

export interface IndicatorValues {
  rsi?: { period: number; overbought: number; oversold: number };
  ema?: { fast: number; slow: number };
  sma?: { period: number };
  macd?: { fast: number; slow: number; signal: number };
  bollinger?: { period: number; stdDev: number };
}

export interface Condition {
  indicator: string;
  operator: '>' | '<' | '>=' | '<=' | 'cross_above' | 'cross_below' | 'between';
  value: number | string;
  value2?: number;
  compareWith?: string;
}

export interface TimeFilter {
  activeHours?: { start: number; end: number }[];
  activeDays?: number[];
  timezone?: string;
}

export interface StrategyConfig {
  type: 'indicator_combination' | 'spread_zscore' | 'lucy';
  broker: string;
  brokerAccountId?: number;
  symbol: string;
  pairSymbol?: string;
  interval: string;
  quantity: number;
  indicators: IndicatorValues;
  entryConditions: Condition[];
  exitConditions: Condition[];
  logic: 'AND' | 'OR';
  timeFilter?: TimeFilter;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  max_open_trades?: number;
  lookback?: number;
  zscore_entry?: number;
  zscore_exit?: number;
  /** Ejecutar órdenes automáticas cuando Lucy aprueba (type=lucy) */
  autoExecute?: boolean;
  /** Confianza mínima de Lucy para auto-ejecutar (0-1) */
  minConfidence?: number;
}

export interface MarketContext {
  symbol: string;
  interval: string;
  klines: WsKline[];
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  currentPrice: number;
  timestamp: number;
}

export interface EvaluatedIndicators {
  rsi?: number;
  emaFast?: number;
  emaSlow?: number;
  sma?: number;
  macd?: { macd: number; signal: number; histogram: number };
  bollinger?: { upper: number; middle: number; lower: number };
}

export interface StrategySignal {
  strategyId: number;
  action: 'enter_long' | 'enter_short' | 'exit' | 'hold';
  confidence: number;
  reason: string;
  indicators: EvaluatedIndicators;
  timestamp: number;
  price: number;
}

// ── Motor de estrategias ──

export class StrategyEngine {

  computeIndicators(closes: number[], config: IndicatorValues): EvaluatedIndicators {
    const result: EvaluatedIndicators = {};

    if (config.rsi && closes.length >= config.rsi.period + 1) {
      const rsi = calcRSI(closes, config.rsi.period);
      result.rsi = Math.round(rsi[rsi.length - 1] * 100) / 100;
    }

    if (config.ema && closes.length >= config.ema.slow + 1) {
      const emaFast = calcEMA(closes, config.ema.fast);
      const emaSlow = calcEMA(closes, config.ema.slow);
      result.emaFast = emaFast[emaFast.length - 1];
      result.emaSlow = emaSlow[emaSlow.length - 1];
    }

    if (config.sma && closes.length >= config.sma.period) {
      const sma = calcSMA(closes, config.sma.period);
      result.sma = sma[sma.length - 1];
    }

    if (config.macd && closes.length >= config.macd.slow + config.macd.signal + 1) {
      const { macd, signal, histogram } = calcMACD(closes, config.macd.fast, config.macd.slow, config.macd.signal);
      result.macd = {
        macd: Math.round(macd[macd.length - 1] * 10000) / 10000,
        signal: Math.round(signal[signal.length - 1] * 10000) / 10000,
        histogram: Math.round(histogram[histogram.length - 1] * 10000) / 10000,
      };
    }

    if (config.bollinger && closes.length >= config.bollinger.period) {
      const window = closes.slice(-config.bollinger.period);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const std = Math.sqrt(window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length);
      result.bollinger = {
        upper: mean + config.bollinger.stdDev * std,
        middle: mean,
        lower: mean - config.bollinger.stdDev * std,
      };
    }

    return result;
  }

  evaluate(strategyId: number, ctx: MarketContext, config: StrategyConfig, indicators: EvaluatedIndicators): StrategySignal {
    if (config.timeFilter && !this.isWithinTimeFilter(config.timeFilter)) {
      return {
        strategyId,
        action: 'hold',
        confidence: 0,
        reason: 'Fuera del horario de la estrategia',
        indicators,
        timestamp: Date.now(),
        price: ctx.currentPrice,
      };
    }
    if (config.type === 'lucy') {
      return {
        strategyId,
        action: 'hold',
        confidence: 0,
        reason: 'Lucy pendiente: SDK/API aún no conectada',
        indicators,
        timestamp: Date.now(),
        price: ctx.currentPrice,
      };
    }
    if (config.type === 'spread_zscore') {
      return this.evaluateSpread(strategyId, ctx, config, indicators);
    }
    return this.evaluateIndicatorCombination(strategyId, ctx, config, indicators);
  }

  private evaluateIndicatorCombination(
    strategyId: number, ctx: MarketContext, config: StrategyConfig, indicators: EvaluatedIndicators
  ): StrategySignal {
    const prevIndicators = this.computeIndicators(ctx.closes.slice(0, -1), config.indicators || {});
    const prevPrice = ctx.closes.length > 1 ? ctx.closes[ctx.closes.length - 2] : null;
    const entryHit = this.evaluateConditions(config.entryConditions, indicators, ctx, config.logic, prevIndicators, prevPrice);
    const exitHit = this.evaluateConditions(config.exitConditions, indicators, ctx, config.logic, prevIndicators, prevPrice);

    let action: StrategySignal['action'] = 'hold';
    let confidence = 0;
    let reason = '';

    if (exitHit.met) {
      action = 'exit';
      confidence = exitHit.score;
      reason = `Exit: ${exitHit.reasons.join(', ')}`;
    } else if (entryHit.met) {
      const hasBearish = config.entryConditions.some(
        (c) => c.indicator === 'rsi' && c.operator === '>'
      );
      action = hasBearish ? 'enter_short' : 'enter_long';
      confidence = entryHit.score;
      reason = `Entry: ${entryHit.reasons.join(', ')}`;
    }

    return { strategyId, action, confidence, reason, indicators, timestamp: ctx.timestamp, price: ctx.currentPrice };
  }

  private evaluateSpread(
    strategyId: number, ctx: MarketContext, config: StrategyConfig, indicators: EvaluatedIndicators
  ): StrategySignal {
    const prevIndicators = this.computeIndicators(ctx.closes.slice(0, -1), config.indicators || {});
    const prevPrice = ctx.closes.length > 1 ? ctx.closes[ctx.closes.length - 2] : null;
    const entry = this.evaluateConditions(config.entryConditions, indicators, ctx, config.logic, prevIndicators, prevPrice);
    const exit = this.evaluateConditions(config.exitConditions, indicators, ctx, config.logic, prevIndicators, prevPrice);

    let action: StrategySignal['action'] = 'hold';
    let reason = '';

    if (exit.met) { action = 'exit'; reason = `Exit: ${exit.reasons.join(', ')}`; }
    else if (entry.met) { action = 'enter_long'; reason = `Entry: ${entry.reasons.join(', ')}`; }

    return { strategyId, action, confidence: entry.score, reason, indicators, timestamp: ctx.timestamp, price: ctx.currentPrice };
  }

  private evaluateConditions(
    conditions: Condition[],
    indicators: EvaluatedIndicators,
    ctx: MarketContext,
    logic: 'AND' | 'OR' = 'AND',
    prevIndicators?: EvaluatedIndicators,
    prevPrice?: number | null,
  ): { met: boolean; score: number; reasons: string[] } {
    if (!conditions || conditions.length === 0) return { met: false, score: 0, reasons: [] };

    const results = conditions.map((c) => this.evaluateCondition(c, indicators, ctx, prevIndicators, prevPrice));
    const met = logic === 'OR' ? results.some((r) => r.met) : results.every((r) => r.met);
    const score = results.filter((r) => r.met).length / results.length;
    const reasons = results.filter((r) => r.met).map((r) => r.reason);

    return { met, score, reasons };
  }

  private evaluateCondition(
    condition: Condition,
    indicators: EvaluatedIndicators,
    ctx: MarketContext,
    prevIndicators?: EvaluatedIndicators,
    prevPrice?: number | null,
  ): { met: boolean; reason: string } {
    const val = this.getIndicatorValue(condition.indicator, indicators, ctx);
    if (val === null) return { met: false, reason: `${condition.indicator}: sin datos` };

    const target = typeof condition.value === 'string'
      ? this.getIndicatorValue(condition.value, indicators, ctx) ?? 0
      : condition.value;

    let met = false;
    switch (condition.operator) {
      case '>': met = val > target; break;
      case '<': met = val < target; break;
      case '>=': met = val >= target; break;
      case '<=': met = val <= target; break;
      case 'between': met = val >= target && val <= (condition.value2 ?? Infinity); break;
      case 'cross_above': {
        const prev = this.getPrevIndicatorValue(condition.indicator, prevIndicators, prevPrice);
        met = prev !== null && prev <= target && val > target;
        break;
      }
      case 'cross_below': {
        const prev = this.getPrevIndicatorValue(condition.indicator, prevIndicators, prevPrice);
        met = prev !== null && prev >= target && val < target;
        break;
      }
    }

    return {
      met,
      reason: `${condition.indicator}=${val.toFixed(2)} ${condition.operator} ${target}`,
    };
  }

  private getIndicatorValue(name: string, indicators: EvaluatedIndicators, ctx: MarketContext): number | null {
    switch (name) {
      case 'rsi': return indicators.rsi ?? null;
      case 'emaFast': return indicators.emaFast ?? null;
      case 'emaSlow': return indicators.emaSlow ?? null;
      case 'sma': return indicators.sma ?? null;
      case 'macd': return indicators.macd?.macd ?? null;
      case 'macd_signal': return indicators.macd?.signal ?? null;
      case 'macd_histogram': return indicators.macd?.histogram ?? null;
      case 'bollinger_upper': return indicators.bollinger?.upper ?? null;
      case 'bollinger_lower': return indicators.bollinger?.lower ?? null;
      case 'bollinger_middle': return indicators.bollinger?.middle ?? null;
      case 'price': return ctx.currentPrice;
      default: return null;
    }
  }

  private getPrevIndicatorValue(
    name: string,
    prevIndicators?: EvaluatedIndicators,
    prevPrice?: number | null,
  ): number | null {
    if (name === 'price') return prevPrice ?? null;
    if (!prevIndicators) return null;
    switch (name) {
      case 'rsi': return prevIndicators.rsi ?? null;
      case 'emaFast': return prevIndicators.emaFast ?? null;
      case 'emaSlow': return prevIndicators.emaSlow ?? null;
      case 'sma': return prevIndicators.sma ?? null;
      case 'macd': return prevIndicators.macd?.macd ?? null;
      case 'macd_signal': return prevIndicators.macd?.signal ?? null;
      case 'macd_histogram': return prevIndicators.macd?.histogram ?? null;
      case 'bollinger_upper': return prevIndicators.bollinger?.upper ?? null;
      case 'bollinger_lower': return prevIndicators.bollinger?.lower ?? null;
      case 'bollinger_middle': return prevIndicators.bollinger?.middle ?? null;
      default: return null;
    }
  }

  private isWithinTimeFilter(filter: TimeFilter): boolean {
    const now = new Date();
    if (filter.activeDays?.length && !filter.activeDays.includes(now.getUTCDay())) {
      return false;
    }
    if (filter.activeHours?.length) {
      const hour = now.getUTCHours();
      const inWindow = filter.activeHours.some((h) => hour >= h.start && hour < h.end);
      if (!inWindow) return false;
    }
    return true;
  }
}

export const strategyEngine = new StrategyEngine();
