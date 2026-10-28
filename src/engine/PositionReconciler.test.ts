import { PositionReconciler } from './PositionReconciler';
import { StrategyState } from './StrategyState';
import Trade from '../models/Trade';

jest.mock('../models/Trade');

describe('PositionReconciler', () => {
  let reconciler: PositionReconciler;
  let states: Map<number, StrategyState>;

  beforeEach(() => {
    reconciler = new PositionReconciler();
    states = new Map<number, StrategyState>();
    jest.clearAllMocks();
  });

  describe('restoreOpenTrades', () => {
    it('restores open positions from database trades into memory state map', async () => {
      const mockTrades = [
        {
          id: 101,
          strategyId: 1,
          side: 'buy',
          entryPrice: 50000,
          openedAt: new Date('2026-01-01T00:00:00Z'),
          ticket: 'TK-101',
          quantity: 0.1,
          raw: {},
        },
      ];

      (Trade.findAll as jest.Mock).mockResolvedValue(mockTrades);

      const count = await reconciler.restoreOpenTrades(states);

      expect(count).toBe(1);
      expect(states.has(1)).toBe(true);

      const state = states.get(1);
      expect(state?.inPosition).toBe(true);
      expect(state?.side).toBe('buy');
      expect(state?.entryPrice).toBe(50000);
      expect(state?.ticket).toBe('TK-101');
      expect(state?.tradeId).toBe(101);
    });

    it('handles spread hedge trades properly', async () => {
      const mockTrades = [
        {
          id: 201,
          strategyId: 2,
          side: 'buy',
          entryPrice: 3000,
          openedAt: new Date('2026-01-01T00:00:00Z'),
          ticket: 'TK-201',
          quantity: 1,
          raw: { spreadLeg: 'primary' },
        },
        {
          id: 202,
          strategyId: 2,
          symbol: 'SOLUSDT',
          side: 'sell',
          entryPrice: 150,
          openedAt: new Date('2026-01-01T00:00:00Z'),
          ticket: 'TK-202',
          quantity: 20,
          raw: { spreadLeg: 'hedge' },
        },
      ];

      (Trade.findAll as jest.Mock).mockResolvedValue(mockTrades);

      const count = await reconciler.restoreOpenTrades(states);

      expect(count).toBe(2);
      expect(states.has(2)).toBe(true);

      const state = states.get(2);
      expect(state?.pairSymbol).toBe('SOLUSDT');
      expect(state?.pairSide).toBe('sell');
      expect(state?.pairEntryPrice).toBe(150);
      expect(state?.pairTicket).toBe('TK-202');
      expect(state?.pairTradeId).toBe(202);
    });

    it('returns 0 and handles DB errors gracefully without crashing', async () => {
      (Trade.findAll as jest.Mock).mockRejectedValue(new Error('DB connection timeout'));

      const count = await reconciler.restoreOpenTrades(states);
      expect(count).toBe(0);
      expect(states.size).toBe(0);
    });
  });

  describe('cleanupClosedStates', () => {
    it('removes state for inactive strategies that have no open positions', async () => {
      states.set(10, {
        strategyId: 10,
        inPosition: false,
        side: 'buy',
        entryPrice: 100,
        entryTime: Date.now(),
      });

      await reconciler.cleanupClosedStates(states, [20, 30]);

      expect(states.has(10)).toBe(false);
    });

    it('keeps state for inactive strategies if they still have open positions to protect', async () => {
      states.set(10, {
        strategyId: 10,
        inPosition: true,
        side: 'buy',
        entryPrice: 100,
        entryTime: Date.now(),
      });

      await reconciler.cleanupClosedStates(states, [20, 30]);

      expect(states.has(10)).toBe(true);
    });
  });
});
