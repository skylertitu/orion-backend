import {
  evaluateCanOpen,
  calculateRealizedDailyPnl,
  type RiskLimits,
} from './risk.service';

describe('risk.service and evaluation rules', () => {
  const defaultLimits: RiskLimits = {
    maxDailyLossUsd: 100,
    maxOrderUsd: 50,
    maxOpenPositions: 3,
    maxErrorStreak: 5,
  };

  describe('calculateRealizedDailyPnl', () => {
    it('sums realized USD profit/loss across closed trades correctly', () => {
      // Trade 1: qty = 1, entry = 100, pnlPct = 0.05 (+5%) -> +5 USD
      // Trade 2: qty = 2, entry = 50, pnlPct = -0.02 (-2%) -> -2 USD
      // Total: +3 USD
      const trades = [
        { quantity: 1, entryPrice: 100, pnlPct: 0.05 },
        { quantity: 2, entryPrice: 50, pnlPct: -0.02 },
      ];
      const pnl = calculateRealizedDailyPnl(trades);
      expect(pnl).toBeCloseTo(3, 4);
    });

    it('handles null, undefined, or string numeric values safely', () => {
      const trades = [
        { quantity: '1.5', entryPrice: '100', pnlPct: '0.1' }, // 15 USD
        { quantity: null, entryPrice: undefined, pnlPct: null }, // 0
      ];
      const pnl = calculateRealizedDailyPnl(trades);
      expect(pnl).toBeCloseTo(15, 4);
    });
  });

  describe('evaluateCanOpen', () => {
    it('allows opening trade when all parameters are well within limits', () => {
      const result = evaluateCanOpen(
        defaultLimits,
        {
          pausedByRisk: false,
          dailyPnlUsd: 10,
          openPositions: 1,
        },
        { notionalUsd: 30, symbol: 'BTCUSDT', strategyId: 1 }
      );

      expect(result.ok).toBe(true);
    });

    it('rejects opening trade when system is paused by risk', () => {
      const result = evaluateCanOpen(
        defaultLimits,
        {
          pausedByRisk: true,
          pauseReason: 'Kill switch activado por racha de errores',
          dailyPnlUsd: 0,
          openPositions: 0,
        },
        { notionalUsd: 20 }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Kill switch activado');
      }
    });

    it('rejects opening trade when daily loss threshold is exceeded', () => {
      // maxDailyLossUsd = 100, current dailyPnlUsd = -105
      const result = evaluateCanOpen(
        defaultLimits,
        {
          pausedByRisk: false,
          dailyPnlUsd: -105,
          openPositions: 0,
        },
        { notionalUsd: 20 }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Pérdida diaria');
        expect(result.reason).toContain('100 USD');
      }
    });

    it('rejects opening trade when max open positions is reached', () => {
      // maxOpenPositions = 3, current openPositions = 3
      const result = evaluateCanOpen(
        defaultLimits,
        {
          pausedByRisk: false,
          dailyPnlUsd: 0,
          openPositions: 3,
        },
        { notionalUsd: 20 }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('posiciones abiertas (máximo 3)');
      }
    });

    it('rejects opening trade when order notional exceeds maxOrderUsd', () => {
      // maxOrderUsd = 50, order is 60 USD
      const result = evaluateCanOpen(
        defaultLimits,
        {
          pausedByRisk: false,
          dailyPnlUsd: 0,
          openPositions: 1,
        },
        { notionalUsd: 60 }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('supera el tope de 50 USD');
      }
    });

    it('ignores limits if set to 0 (disabled)', () => {
      const disabledLimits: RiskLimits = {
        maxDailyLossUsd: 0,
        maxOrderUsd: 0,
        maxOpenPositions: 0,
        maxErrorStreak: 0,
      };

      const result = evaluateCanOpen(
        disabledLimits,
        {
          pausedByRisk: false,
          dailyPnlUsd: -5000,
          openPositions: 20,
        },
        { notionalUsd: 10000 }
      );

      expect(result.ok).toBe(true);
    });
  });
});
