/**
 * Research backtest (Freqtrade/Jesse-inspired): dry simulation on OHLCV.
 * Does not place live orders and does not touch TradingWorker state.
 */
import { createCcxtExchange, type CcxtBrokerId } from '../engine/ccxt/ccxtFactory';
import { ccxtFetchOhlcv } from '../engine/ccxt/ccxtOps';
import {
  strategyEngine,
  type MarketContext,
  type StrategyConfig,
} from '../engine/StrategyEngine';
import { WsKline } from '../services/binanceWs';
import { binancePublicGet } from '../services/binancePublic';
import { normalizeSymbol } from '../config/binance';
import { signedPnlPct, evaluateRiskLimits } from '../engine/pnl';

export interface BacktestTrade {
  side: 'buy' | 'sell';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  rawPnlPct?: number;
  feePct?: number;
  reason: string;
}

export interface BacktestResult {
  broker: string;
  symbol: string;
  interval: string;
  candles: number;
  trades: BacktestTrade[];
  winRate: number;
  totalPnlPct: number;
  grossPnlPct: number;
  totalFeesPct: number;
  maxDrawdownPct: number;
  via: 'ccxt' | 'binance_public';
}

export interface BacktestRequest {
  broker?: CcxtBrokerId;
  symbol: string;
  interval?: string;
  limit?: number;
  config: StrategyConfig;
  feeRate?: number;
  slippagePct?: number;
}

function toKlines(
  rows: Array<[number, number, number, number, number, number]>,
  symbol: string,
  interval: string
): WsKline[] {
  return rows.map((r) => ({
    symbol,
    interval,
    openTime: r[0],
    open: r[1],
    high: r[2],
    low: r[3],
    close: r[4],
    volume: r[5],
    closeTime: r[0],
    isFinal: true,
  }));
}

async function fetchCandles(
  broker: CcxtBrokerId,
  symbol: string,
  interval: string,
  limit: number
): Promise<{ rows: Array<[number, number, number, number, number, number]>; via: 'ccxt' | 'binance_public' }> {
  try {
    const exchange = createCcxtExchange(broker, {});
    const rows = await ccxtFetchOhlcv(exchange, symbol, interval, limit);
    if (rows.length > 10) return { rows, via: 'ccxt' };
  } catch {
    /* public Binance fallback for research */
  }

  const normalized = normalizeSymbol(symbol);
  const qs = new URLSearchParams({
    symbol: normalized,
    interval,
    limit: String(Math.min(1000, Math.max(50, limit))),
  });
  const raw = await binancePublicGet<string[][]>(`/klines?${qs.toString()}`);
  const rows = raw.map((k) => [
    Number(k[0]),
    Number(k[1]),
    Number(k[2]),
    Number(k[3]),
    Number(k[4]),
    Number(k[5]),
  ]) as Array<[number, number, number, number, number, number]>;
  return { rows, via: 'binance_public' };
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestResult> {
  const broker = req.broker || 'binance';
  const symbol = (req.symbol || 'BTCUSDT').toUpperCase();
  const interval = req.interval || req.config.interval || '15m';
  const limit = Math.min(1000, Math.max(80, req.limit || 300));
  const config: StrategyConfig = {
    ...req.config,
    symbol,
    interval,
    broker,
  };

  if (config.type === 'lucy') {
    throw new Error('Backtest no disponible para estrategias Lucy (SDK pendiente)');
  }
  if (config.type === 'spread_zscore') {
    throw new Error('Backtest de spread aún no soportado; usa indicadores (RSI)');
  }

  const { rows, via } = await fetchCandles(broker, symbol, interval, limit);
  const klines = toKlines(rows, symbol, interval);
  const warmup = Math.min(80, Math.floor(klines.length / 3));

  const trades: BacktestTrade[] = [];
  let inPosition = false;
  let side: 'buy' | 'sell' = 'buy';
  let entryPrice = 0;
  let entryTime = 0;
  const feeRate = req.feeRate != null && req.feeRate >= 0 ? req.feeRate : 0.001;
  const slippagePct = req.slippagePct != null && req.slippagePct >= 0 ? req.slippagePct : 0.05;
  const roundtripFeePct = feeRate * 200;

  let equity = 0;
  let grossEquity = 0;
  let totalFees = 0;
  let peak = 0;
  let maxDrawdownPct = 0;

  for (let i = warmup; i < klines.length; i++) {
    const window = klines.slice(0, i + 1);
    const closes = window.map((k) => k.close);
    const ctx: MarketContext = {
      symbol,
      interval,
      klines: window,
      closes,
      highs: window.map((k) => k.high),
      lows: window.map((k) => k.low),
      volumes: window.map((k) => k.volume),
      currentPrice: closes[closes.length - 1],
      timestamp: window[window.length - 1].openTime,
    };

    const indicators = strategyEngine.computeIndicators(closes, config.indicators || {});
    const signal = strategyEngine.evaluate(0, ctx, config, indicators);
    const price = ctx.currentPrice;

    if (inPosition) {
      const rawPnl = signedPnlPct(side, entryPrice, price);
      const riskTrigger = evaluateRiskLimits(rawPnl, config.stop_loss_pct, config.take_profit_pct);
      if (signal.action === 'exit' || riskTrigger) {
        const netPnl = rawPnl - roundtripFeePct - slippagePct;
        const reason = riskTrigger || signal.reason || 'exit';
        trades.push({
          side,
          entryTime,
          exitTime: ctx.timestamp,
          entryPrice,
          exitPrice: price,
          pnlPct: Math.round(netPnl * 100) / 100,
          rawPnlPct: Math.round(rawPnl * 100) / 100,
          feePct: Math.round((roundtripFeePct + slippagePct) * 100) / 100,
          reason,
        });
        equity += netPnl;
        grossEquity += rawPnl;
        totalFees += roundtripFeePct + slippagePct;
        peak = Math.max(peak, equity);
        maxDrawdownPct = Math.max(maxDrawdownPct, peak - equity);
        inPosition = false;
      }
    } else if (signal.action === 'enter_long' || signal.action === 'enter_short') {
      inPosition = true;
      side = signal.action === 'enter_long' ? 'buy' : 'sell';
      entryPrice = price;
      entryTime = ctx.timestamp;
    }
  }

  if (inPosition && klines.length) {
    const last = klines[klines.length - 1];
    const rawPnl = signedPnlPct(side, entryPrice, last.close);
    const netPnl = rawPnl - roundtripFeePct - slippagePct;
    trades.push({
      side,
      entryTime,
      exitTime: last.openTime,
      entryPrice,
      exitPrice: last.close,
      pnlPct: Math.round(netPnl * 100) / 100,
      rawPnlPct: Math.round(rawPnl * 100) / 100,
      feePct: Math.round((roundtripFeePct + slippagePct) * 100) / 100,
      reason: 'end_of_series',
    });
    equity += netPnl;
    grossEquity += rawPnl;
    totalFees += roundtripFeePct + slippagePct;
    peak = Math.max(peak, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, peak - equity);
  }

  const wins = trades.filter((t) => t.pnlPct > 0).length;
  return {
    broker,
    symbol,
    interval,
    candles: klines.length,
    trades,
    winRate: trades.length ? Math.round((wins / trades.length) * 1000) / 10 : 0,
    totalPnlPct: Math.round(equity * 100) / 100,
    grossPnlPct: Math.round(grossEquity * 100) / 100,
    totalFeesPct: Math.round(totalFees * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
    via,
  };
}
