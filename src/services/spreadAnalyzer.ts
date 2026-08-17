import { normalizeSymbol } from '../config/binance';
import { binancePublicGet } from './binancePublic';

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface SpreadSignal {
  symbol: string;
  pairSymbol: string;
  action: 'buy_spread' | 'sell_spread' | 'close' | 'hold';
  zScore: number;
  spread: number;
  spreadMean: number;
  spreadStd: number;
  price1: number;
  price2: number;
  timestamp: number;
}

export interface SpreadConfig {
  symbol: string;
  pairSymbol: string;
  lookbackPeriod: number;
  zscoreEntry: number;
  zscoreExit: number;
  klinesInterval: string;
}

export class SpreadAnalyzer {
  private cache = new Map<string, { data: Kline[]; expiry: number }>();
  private readonly CACHE_TTL_MS = 10_000;

  async fetchKlines(symbol: string, interval: string, limit: number): Promise<Kline[]> {
    const normalized = normalizeSymbol(symbol);
    const cacheKey = `${normalized}:${interval}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const raw = await binancePublicGet<any[]>(
      `/klines?symbol=${encodeURIComponent(normalized)}&interval=${encodeURIComponent(interval)}&limit=${limit}`
    );
    const klines: Kline[] = raw.map((k) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    }));

    this.cache.set(cacheKey, { data: klines, expiry: Date.now() + this.CACHE_TTL_MS });
    return klines;
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    const normalized = normalizeSymbol(symbol);
    const data = await binancePublicGet<{ price: string }>(
      `/ticker/price?symbol=${encodeURIComponent(normalized)}`
    );
    return parseFloat(data.price);
  }

  async analyze(config: SpreadConfig): Promise<SpreadSignal> {
    const { symbol, pairSymbol, lookbackPeriod, zscoreEntry, zscoreExit, klinesInterval } = config;

    const [klines1, klines2] = await Promise.all([
      this.fetchKlines(symbol, klinesInterval, lookbackPeriod + 10),
      this.fetchKlines(pairSymbol, klinesInterval, lookbackPeriod + 10),
    ]);

    if (klines1.length < lookbackPeriod || klines2.length < lookbackPeriod) {
      return this.holdSignal(symbol, pairSymbol, 0, 0, 0, 0);
    }

    const aligned = this.alignKlines(klines1, klines2, lookbackPeriod);
    if (aligned.closes1.length < lookbackPeriod) {
      return this.holdSignal(symbol, pairSymbol, 0, 0, 0, 0);
    }

    const spreads = this.calculateSpread(aligned.closes1, aligned.closes2);
    const mean = this.mean(spreads);
    const std = this.std(spreads);

    if (std === 0) {
      return this.holdSignal(symbol, pairSymbol, spreads[spreads.length - 1], mean, std, 0);
    }

    const currentSpread = spreads[spreads.length - 1];
    const zScore = (currentSpread - mean) / std;

    const price1 = aligned.closes1[aligned.closes1.length - 1];
    const price2 = aligned.closes2[aligned.closes2.length - 1];

    let action: SpreadSignal['action'] = 'hold';
    if (zScore > zscoreEntry) {
      action = 'sell_spread';
    } else if (zScore < -zscoreEntry) {
      action = 'buy_spread';
    } else if (Math.abs(zScore) < zscoreExit) {
      action = 'close';
    }

    return {
      symbol,
      pairSymbol,
      action,
      zScore: Math.round(zScore * 1000) / 1000,
      spread: currentSpread,
      spreadMean: mean,
      spreadStd: std,
      price1,
      price2,
      timestamp: Date.now(),
    };
  }

  private alignKlines(
    k1: Kline[],
    k2: Kline[],
    limit: number
  ): { closes1: number[]; closes2: number[] } {
    const map2 = new Map<number, number>();
    for (const k of k2) map2.set(k.closeTime, k.close);

    const closes1: number[] = [];
    const closes2: number[] = [];

    for (const k of k1) {
      const match = map2.get(k.closeTime);
      if (match !== undefined) {
        closes1.push(k.close);
        closes2.push(match);
      }
    }

    const start = Math.max(0, closes1.length - limit);
    return {
      closes1: closes1.slice(start),
      closes2: closes2.slice(start),
    };
  }

  private calculateSpread(prices1: number[], prices2: number[]): number[] {
    return prices1.map((p, i) => {
      const ratio = p / prices2[i];
      return Math.log(ratio);
    });
  }

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private std(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = this.mean(arr);
    const variance = arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(variance);
  }

  private holdSignal(
    symbol: string,
    pairSymbol: string,
    spread: number,
    mean: number,
    std: number,
    zScore: number
  ): SpreadSignal {
    return {
      symbol,
      pairSymbol,
      action: 'hold',
      zScore,
      spread,
      spreadMean: mean,
      spreadStd: std,
      price1: 0,
      price2: 0,
      timestamp: Date.now(),
    };
  }
}

export const spreadAnalyzer = new SpreadAnalyzer();
