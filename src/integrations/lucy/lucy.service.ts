import { LucyConfig, LucyChartRequest, LucyAnalysisResult, LucySignal } from './lucy.types';
import { LUCY_INTEGRATION } from './lucy.pending';
import { calcRSI } from '../../engine/StrategyEngine';
import { binancePublicGet } from '../../services/binancePublic';
import { normalizeSymbol } from '../../config/binance';
import { logger } from '../../utils/logger';

const DEFAULT_CONFIG: LucyConfig = {
  apiUrl: process.env.LUCY_API_URL || 'http://localhost:5000',
  apiKey: process.env.LUCY_API_KEY || '',
  timeout: 30000,
};

async function ensureCloses(data: LucyChartRequest): Promise<number[][]> {
  if (Array.isArray(data.data) && data.data.length >= 30) return data.data;
  try {
    const symbol = normalizeSymbol(data.symbol || 'BTCUSDT');
    const interval = data.interval || '15m';
    const raw = await binancePublicGet<string[][]>(
      `/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=120`
    );
    return raw.map((k) => [
      Number(k[0]),
      Number(k[1]),
      Number(k[2]),
      Number(k[3]),
      Number(k[4]),
      Number(k[5]),
    ]);
  } catch (err: any) {
    logger.warn(`[lucy] No se pudieron cargar velas locales: ${err?.message || err}`);
    return data.data || [];
  }
}

function localAnalyze(data: LucyChartRequest, rows: number[][]): LucyAnalysisResult {
  const closes = rows
    .map((row) => Number(row[4] ?? row[1] ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);

  const price = closes[closes.length - 1] || 0;
  const period = 14;
  const rsiSeries = closes.length >= period + 1 ? calcRSI(closes, period) : [];
  const rsi = rsiSeries.length ? rsiSeries[rsiSeries.length - 1] : 50;

  let action: LucySignal['action'] = 'hold';
  let confidence = 0.35;
  let trend: LucyAnalysisResult['trend'] = 'neutral';

  if (rsi <= 30) {
    action = 'buy';
    confidence = Math.min(0.85, 0.45 + (30 - rsi) / 100);
    trend = 'bullish';
  } else if (rsi >= 70) {
    action = 'sell';
    confidence = Math.min(0.85, 0.45 + (rsi - 70) / 100);
    trend = 'bearish';
  }

  const window = closes.slice(-20);
  const support = window.length ? Math.min(...window) : price;
  const resistance = window.length ? Math.max(...window) : price;

  const signal: LucySignal = {
    symbol: data.symbol,
    action,
    confidence: Math.round(confidence * 100) / 100,
    timestamp: new Date().toISOString(),
    indicators: { rsi: Math.round(rsi * 100) / 100, mode: 'local', price },
  };

  return {
    success: true,
    signals: action === 'hold' ? [] : [signal],
    patterns:
      action === 'hold' ? ['rsi_neutral'] : action === 'buy' ? ['rsi_oversold'] : ['rsi_overbought'],
    support,
    resistance,
    trend,
  };
}

class LucyService {
  private config: LucyConfig;

  constructor(config: Partial<LucyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  async analyzeChart(data: LucyChartRequest): Promise<LucyAnalysisResult> {
    if (LUCY_INTEGRATION.pending) {
      throw new Error(LUCY_INTEGRATION.reason);
    }
    if (LUCY_INTEGRATION.mode === 'local') {
      const rows = await ensureCloses(data);
      return localAnalyze({ ...data, data: rows }, rows);
    }

    try {
      const rows = await ensureCloses(data);
      const payload = { ...data, data: rows };
      const res = await fetch(`${this.config.apiUrl}/analyze`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!res.ok) {
        const err = `Lucy API error: ${res.status} ${res.statusText}`;
        logger.error(`[lucy] Envío /analyze fallido: ${err}`);
        throw new Error(err);
      }

      return res.json() as Promise<LucyAnalysisResult>;
    } catch (err: any) {
      if (!String(err.message || '').startsWith('Lucy API error')) {
        logger.error(`[lucy] Envío /analyze fallido: ${err.message || err}`);
      }
      throw err;
    }
  }

  async getSignals(symbol: string): Promise<LucyAnalysisResult> {
    if (LUCY_INTEGRATION.pending) {
      throw new Error(LUCY_INTEGRATION.reason);
    }
    if (LUCY_INTEGRATION.mode === 'local') {
      return this.analyzeChart({ symbol, interval: '15m', data: [] });
    }

    try {
      const res = await fetch(`${this.config.apiUrl}/signals/${symbol}`, {
        headers: this.headers,
      });

      if (!res.ok) {
        const err = `Lucy API error: ${res.status} ${res.statusText}`;
        logger.error(`[lucy] Envío /signals/${symbol} fallido: ${err}`);
        throw new Error(err);
      }

      return res.json() as Promise<LucyAnalysisResult>;
    } catch (err: any) {
      if (!String(err.message || '').startsWith('Lucy API error')) {
        logger.error(`[lucy] Envío /signals/${symbol} fallido: ${err.message || err}`);
      }
      throw err;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (LUCY_INTEGRATION.pending) return false;
    if (LUCY_INTEGRATION.mode === 'local') return true;

    try {
      const res = await fetch(`${this.config.apiUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const lucyService = new LucyService();
export { DEFAULT_CONFIG };
