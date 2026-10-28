import {
  calcSMA,
  calcEMA,
  calcRSI,
  calcMACD,
  StrategyEngine,
  type IndicatorValues,
  type MarketContext,
  type StrategyConfig,
} from './StrategyEngine';

describe('StrategyEngine and Technical Indicators', () => {
  const engine = new StrategyEngine();

  describe('calcSMA', () => {
    it('calculates simple moving average correctly', () => {
      const closes = [10, 20, 30, 40, 50];
      const sma = calcSMA(closes, 3);
      // for indices < 2, should be 0
      expect(sma[0]).toBe(0);
      expect(sma[1]).toBe(0);
      // index 2: (10 + 20 + 30) / 3 = 20
      expect(sma[2]).toBe(20);
      // index 3: (20 + 30 + 40) / 3 = 30
      expect(sma[3]).toBe(30);
      // index 4: (30 + 40 + 50) / 3 = 40
      expect(sma[4]).toBe(40);
    });
  });

  describe('calcEMA', () => {
    it('calculates exponential moving average with seed and smoothing', () => {
      const closes = [10, 11, 12, 13, 14, 15];
      const ema = calcEMA(closes, 3);
      // First 2 elements should be 0
      expect(ema[0]).toBe(0);
      expect(ema[1]).toBe(0);
      // Third element is SMA: (10 + 11 + 12) / 3 = 11
      expect(ema[2]).toBeCloseTo(11, 4);
      // Fourth element: k = 2 / (3 + 1) = 0.5; 13 * 0.5 + 11 * 0.5 = 12
      expect(ema[3]).toBeCloseTo(12, 4);
    });
  });

  describe('calcRSI', () => {
    it('calculates RSI values between 0 and 100', () => {
      // Steady uptrend: RSI should be high (> 70)
      const uptrend = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      const rsiUp = calcRSI(uptrend, 5);
      const lastUp = rsiUp[rsiUp.length - 1];
      expect(lastUp).toBe(100); // Only gains, 0 losses

      // Steady downtrend: RSI should be low (0)
      const downtrend = [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13];
      const rsiDown = calcRSI(downtrend, 5);
      const lastDown = rsiDown[rsiDown.length - 1];
      expect(lastDown).toBe(0);
    });
  });

  describe('calcMACD', () => {
    it('returns macd line, signal line, and histogram', () => {
      const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 10);
      const result = calcMACD(closes, 12, 26, 9);
      expect(result.macd).toBeDefined();
      expect(result.signal).toBeDefined();
      expect(result.histogram).toBeDefined();
      expect(result.macd.length).toBe(closes.length);
      expect(result.signal.length).toBe(closes.length);
      expect(result.histogram.length).toBe(closes.length);
    });
  });

  describe('computeIndicators', () => {
    it('computes all requested indicators into an evaluated snapshot', () => {
      const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
      const config: IndicatorValues = {
        rsi: { period: 14, overbought: 70, oversold: 30 },
        sma: { period: 20 },
        ema: { fast: 9, slow: 21 },
        bollinger: { period: 20, stdDev: 2 },
      };

      const result = engine.computeIndicators(closes, config);

      expect(result.rsi).toBeDefined();
      expect(result.rsi).toBeGreaterThan(50);
      expect(result.sma).toBeDefined();
      expect(result.emaFast).toBeDefined();
      expect(result.emaSlow).toBeDefined();
      expect(result.bollinger).toBeDefined();
      expect(result.bollinger!.upper).toBeGreaterThan(result.bollinger!.middle);
      expect(result.bollinger!.middle).toBeGreaterThan(result.bollinger!.lower);
    });
  });

  describe('evaluate strategy signals', () => {
    it('evaluates entry conditions when RSI is oversold', () => {
      const closes = Array.from({ length: 30 }, (_, i) => 100 - i * 2);
      const ctx: MarketContext = {
        symbol: 'BTCUSDT',
        interval: '15m',
        klines: [],
        closes,
        highs: closes.map((c) => c + 1),
        lows: closes.map((c) => c - 1),
        volumes: closes.map(() => 10),
        currentPrice: closes[closes.length - 1],
        timestamp: Date.now(),
      };

      const config: StrategyConfig = {
        type: 'indicator_combination',
        broker: 'binance',
        symbol: 'BTCUSDT',
        interval: '15m',
        quantity: 0.01,
        logic: 'AND',
        indicators: {
          rsi: { period: 14, overbought: 70, oversold: 30 },
        },
        entryConditions: [
          { indicator: 'rsi', operator: '<', value: 30 },
        ],
        exitConditions: [
          { indicator: 'rsi', operator: '>', value: 70 },
        ],
      };

      const indicators = engine.computeIndicators(closes, config.indicators);
      const signal = engine.evaluate(1, ctx, config, indicators);

      expect(signal.action).toBe('enter_long');
      expect(signal.confidence).toBeGreaterThan(0);
    });
  });
});
