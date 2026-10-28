import {
  signedPnlRatio,
  signedPnlPct,
  spreadPnlRatio,
  spreadPnlPct,
  evaluateRiskLimits,
} from './pnl';

describe('pnl calculations and risk limit triggers', () => {
  describe('signedPnlRatio', () => {
    it('calculates long (buy) profit as decimal ratio', () => {
      // Entry 100, current 105 -> +5% profit = 0.05
      const ratio = signedPnlRatio('buy', 100, 105);
      expect(ratio).toBeCloseTo(0.05, 5);
    });

    it('calculates long (buy) loss as decimal ratio', () => {
      // Entry 100, current 98 -> -2% loss = -0.02
      const ratio = signedPnlRatio('buy', 100, 98);
      expect(ratio).toBeCloseTo(-0.02, 5);
    });

    it('calculates short (sell) profit as decimal ratio', () => {
      // Entry 100, current 95 -> +5% profit = 0.05
      const ratio = signedPnlRatio('sell', 100, 95);
      expect(ratio).toBeCloseTo(0.05, 5);
    });

    it('calculates short (sell) loss as decimal ratio', () => {
      // Entry 100, current 102 -> -2% loss = -0.02
      const ratio = signedPnlRatio('sell', 100, 102);
      expect(ratio).toBeCloseTo(-0.02, 5);
    });

    it('returns 0 safely when entryPrice is 0 or negative', () => {
      expect(signedPnlRatio('buy', 0, 100)).toBe(0);
      expect(signedPnlRatio('sell', -50, 100)).toBe(0);
    });
  });

  describe('signedPnlPct', () => {
    it('converts decimal ratio to human/UI percentage', () => {
      expect(signedPnlPct('buy', 100, 102)).toBeCloseTo(2.0, 4);
      expect(signedPnlPct('buy', 100, 98)).toBeCloseTo(-2.0, 4);
      expect(signedPnlPct('sell', 100, 96)).toBeCloseTo(4.0, 4);
      expect(signedPnlPct('sell', 100, 103)).toBeCloseTo(-3.0, 4);
    });
  });

  describe('spreadPnlRatio and spreadPnlPct', () => {
    it('calculates weighted spread PnL correctly for two balanced legs', () => {
      // Leg 1: buy 1 unit at 100, now 102 (+2%)
      // Leg 2: sell 1 unit at 100, now 99 (+1%)
      // Total profit: (+2 + +1) / (100 + 100) = 3 / 200 = 0.015 (1.5%)
      const ratio = spreadPnlRatio('buy', 100, 102, 1, 'sell', 100, 99, 1);
      expect(ratio).toBeCloseTo(0.015, 5);

      const pct = spreadPnlPct('buy', 100, 102, 1, 'sell', 100, 99, 1);
      expect(pct).toBeCloseTo(1.5, 4);
    });

    it('handles single leg or missing second leg without throwing', () => {
      const ratio = spreadPnlRatio('buy', 100, 105, 1);
      expect(ratio).toBeCloseTo(0.05, 5);
    });
  });

  describe('evaluateRiskLimits (Stop Loss and Take Profit in % units)', () => {
    it('triggers stop_loss when loss reaches or exceeds stop_loss_pct', () => {
      // Exact hit: -2.0% with stop_loss_pct = 2
      expect(evaluateRiskLimits(-2.0, 2, 4)).toBe('stop_loss');

      // Exceeded hit: -2.5% with stop_loss_pct = 2
      expect(evaluateRiskLimits(-2.5, 2, 4)).toBe('stop_loss');
    });

    it('does NOT trigger stop_loss when loss is below threshold', () => {
      // -1.9% loss with stop_loss_pct = 2
      expect(evaluateRiskLimits(-1.9, 2, 4)).toBeNull();

      // Positive PnL (+1.0%) with stop_loss_pct = 2
      expect(evaluateRiskLimits(1.0, 2, 4)).toBeNull();
    });

    it('triggers take_profit when profit reaches or exceeds take_profit_pct', () => {
      // Exact hit: +4.0% with take_profit_pct = 4
      expect(evaluateRiskLimits(4.0, 2, 4)).toBe('take_profit');

      // Exceeded hit: +4.5% with take_profit_pct = 4
      expect(evaluateRiskLimits(4.5, 2, 4)).toBe('take_profit');
    });

    it('does NOT trigger take_profit when profit is below threshold', () => {
      // +3.9% profit with take_profit_pct = 4
      expect(evaluateRiskLimits(3.9, 2, 4)).toBeNull();
    });

    it('handles negative or invalid configuration values robustly using Math.abs', () => {
      // If user/config passed -2 instead of 2 for stop_loss_pct
      expect(evaluateRiskLimits(-2.1, -2, 4)).toBe('stop_loss');
    });

    it('returns null if no SL/TP thresholds are configured', () => {
      expect(evaluateRiskLimits(-5.0, undefined, undefined)).toBeNull();
      expect(evaluateRiskLimits(10.0, null, null)).toBeNull();
      expect(evaluateRiskLimits(-5.0, 0, 0)).toBeNull();
    });
  });
});
