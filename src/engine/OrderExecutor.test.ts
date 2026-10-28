import { OrderExecutor } from './OrderExecutor';

describe('OrderExecutor', () => {
  const executor = new OrderExecutor();

  describe('roundQty', () => {
    it('rounds quantities >= 1 to 3 decimal places', () => {
      expect(executor.roundQty(1.23456)).toBe(1.235);
      expect(executor.roundQty(10.0001)).toBe(10);
    });

    it('rounds quantities < 1 to 6 decimal places', () => {
      expect(executor.roundQty(0.000123456)).toBe(0.000123);
      expect(executor.roundQty(0.05)).toBe(0.05);
    });

    it('returns 0 for negative, 0 or non-finite inputs', () => {
      expect(executor.roundQty(0)).toBe(0);
      expect(executor.roundQty(-5)).toBe(0);
      expect(executor.roundQty(NaN)).toBe(0);
    });
  });
});
