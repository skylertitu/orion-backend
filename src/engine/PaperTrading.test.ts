import { executionModeOf, isPaperTradingForced } from './executionMode';
import { tradingEngine } from './TradingEngine';
import { paperTradingService } from '../services/paperTrading.service';
import { Trade, BrokerAccount } from '../models';
import { IBrokerAdapter } from './IBrokerAdapter';

describe('Paper Trading Engine & Safety Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('executionModeOf & Paper Trading Overrides', () => {
    it('defaults to demo when no mode is provided', () => {
      expect(executionModeOf({}, 'mainnet')).toBe('demo');
    });

    it('returns live when explicitly configured and environment is normal', () => {
      delete process.env.PAPER_TRADING;
      delete process.env.FORCE_PAPER_TRADING;
      delete process.env.PAPER_MODE;
      expect(executionModeOf({ executionMode: 'live' }, 'mainnet')).toBe('live');
    });

    it('forces demo when PAPER_TRADING=true even if account meta is live', () => {
      process.env.PAPER_TRADING = 'true';
      expect(isPaperTradingForced()).toBe(true);
      expect(executionModeOf({ executionMode: 'live' }, 'mainnet')).toBe('demo');
    });

    it('forces demo when FORCE_PAPER_TRADING=true', () => {
      process.env.FORCE_PAPER_TRADING = 'true';
      expect(isPaperTradingForced()).toBe(true);
      expect(executionModeOf({ executionMode: 'live' }, 'mainnet')).toBe('demo');
    });
  });

  describe('TradingEngine paperFill execution', () => {
    const mockAdapter: IBrokerAdapter = {
      brokerId: 'binance',
      label: 'Mock Binance',
      isConnected: jest.fn().mockResolvedValue(true),
      getPrice: jest.fn().mockResolvedValue(50000),
      getPositions: jest.fn().mockResolvedValue([]),
      executeOrder: jest.fn(),
      closePosition: jest.fn(),
    };

    beforeAll(() => {
      tradingEngine.register(mockAdapter);
    });

    it('executes paper buy order with simulated slippage and fee estimation', async () => {
      process.env.PAPER_TRADING = 'true';
      process.env.PAPER_SLIPPAGE_PCT = '0.001'; // 0.1%
      process.env.PAPER_FEE_RATE = '0.001'; // 0.1%

      const result = await tradingEngine.execute({
        broker: 'binance',
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.5,
      });

      expect(result.success).toBe(true);
      expect(String(result.ticket)).toMatch(/^SIMULATED-/);
      // Base price 50000 + 0.1% slippage = 50050
      expect(result.executedPrice).toBeCloseTo(50050, 2);
      expect(result.raw?.mode).toBe('demo');
      expect(result.raw?.estimatedFeeUsd).toBeCloseTo(50050 * 0.5 * 0.001, 2);
    });

    it('executes paper sell order with slippage below market price', async () => {
      process.env.PAPER_TRADING = 'true';
      process.env.PAPER_SLIPPAGE_PCT = '0.001'; // 0.1%

      const result = await tradingEngine.execute({
        broker: 'binance',
        symbol: 'BTCUSDT',
        side: 'sell',
        quantity: 1,
      });

      expect(result.success).toBe(true);
      // Base price 50000 - 0.1% slippage = 49950
      expect(result.executedPrice).toBeCloseTo(49950, 2);
    });

    it('fails cleanly if market price is 0 or unavailable', async () => {
      process.env.PAPER_TRADING = 'true';
      (mockAdapter.getPrice as jest.Mock).mockResolvedValueOnce(0);

      const result = await tradingEngine.execute({
        broker: 'binance',
        symbol: 'FAILUSDT',
        side: 'buy',
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No se pudo obtener el precio de mercado');
    });
  });

  describe('TradingEngine.closePosition for paper trades', () => {
    it('closes paper trade, computes signed PnL and updates database', async () => {
      const mockTrade: any = {
        id: 999,
        userId: 1,
        ticket: 'SIMULATED-TEST-1',
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 1,
        entryPrice: 40000,
        status: 'open',
        raw: { mode: 'demo' },
        update: jest.fn().mockImplementation((updates) => Object.assign(mockTrade, updates)),
      };

      jest.spyOn(Trade, 'findOne').mockResolvedValue(mockTrade as any);
      jest.spyOn(BrokerAccount, 'findOne').mockResolvedValue({
        id: 10,
        userId: 1,
        brokerId: 'binance',
        accountName: 'Demo Binance',
        accountType: 'spot',
        environment: 'testnet',
        status: 'active',
        meta: { executionMode: 'demo' },
      } as any);

      const result = await tradingEngine.closePosition('binance', 'SIMULATED-TEST-1', 1);

      expect(result.success).toBe(true);
      expect(mockTrade.update).toHaveBeenCalled();
      expect(mockTrade.status).toBe('closed');
      expect(mockTrade.closeReason).toBe('demo_close');
      expect(mockTrade.pnlPct).toBeGreaterThan(0); // Exit at 50000 vs entry 40000 is ~25% profit
    });
  });

  describe('PaperTradingService', () => {
    it('calculates paper portfolio summary accurately', async () => {
      const mockClosedTrade: any = {
        id: 1,
        userId: 42,
        ticket: 'SIMULATED-1',
        broker: 'binance',
        brokerAccountId: 10,
        symbol: 'ETHUSDT',
        side: 'buy',
        quantity: 2,
        entryPrice: 3000,
        exitPrice: 3300,
        status: 'closed',
        pnlPct: 0.1,
        raw: { mode: 'demo', pnlUsd: 590 },
      };

      const mockOpenTrade: any = {
        id: 2,
        userId: 42,
        ticket: 'SIMULATED-2',
        broker: 'binance',
        brokerAccountId: 10,
        symbol: 'BTCUSDT',
        side: 'buy',
        quantity: 0.1,
        entryPrice: 45000,
        status: 'open',
        openedAt: new Date(),
        raw: { mode: 'demo' },
      };

      jest.spyOn(Trade, 'findAll').mockResolvedValue([mockClosedTrade, mockOpenTrade] as any);
      jest.spyOn(BrokerAccount, 'findOne').mockResolvedValue({
        id: 10,
        userId: 42,
        brokerId: 'binance',
        accountName: 'Demo Binance',
        accountType: 'spot',
        environment: 'testnet',
        status: 'active',
        meta: { paperInitialBalance: 10000, executionMode: 'demo' },
      } as any);
      jest.spyOn(tradingEngine, 'getPrice').mockResolvedValue(50000);

      // BTC price is 50000, entry was 45000.
      // Unrealized PnL = (50000 - 45000) * 0.1 = +500
      const summary = await paperTradingService.getPaperSummary(42, 10);

      expect(summary.initialBalance).toBe(10000);
      expect(summary.realizedPnlUsd).toBe(590);
      expect(summary.unrealizedPnlUsd).toBeCloseTo(500, 1);
      expect(summary.equityUsd).toBeCloseTo(10000 + 590 + 500, 1);
      expect(summary.winCount).toBe(1);
      expect(summary.closedTradesCount).toBe(1);
      expect(summary.openPositionsCount).toBe(1);
      expect(summary.winRatePct).toBe(100);
    });

    it('resets paper account and archives simulated trades', async () => {
      const updateTradeSpy = jest.spyOn(Trade, 'update').mockResolvedValue([2] as any);
      const mockAccount: any = {
        id: 10,
        userId: 42,
        meta: {},
        update: jest.fn().mockImplementation((updates) => Object.assign(mockAccount, updates)),
      };
      jest.spyOn(BrokerAccount, 'findOne').mockResolvedValue(mockAccount as any);
      jest.spyOn(Trade, 'findAll').mockResolvedValue([] as any);

      const summary = await paperTradingService.resetPaperTrading(42, 10, 25000);

      expect(updateTradeSpy).toHaveBeenCalled();
      expect(mockAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ paperInitialBalance: 25000 }),
        })
      );
      expect(summary.initialBalance).toBe(25000);
      expect(summary.openPositionsCount).toBe(0);
    });
  });
});
