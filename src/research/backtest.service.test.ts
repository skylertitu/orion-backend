import { runBacktest, BacktestRequest } from './backtest.service';
import * as ccxtOps from '../engine/ccxt/ccxtOps';

jest.mock('../engine/ccxt/ccxtOps');
jest.mock('../engine/ccxt/ccxtFactory', () => ({
  createCcxtExchange: jest.fn().mockReturnValue({}),
}));

describe('BacktestService with realistic fees and slippage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deducts fees and slippage from raw trade PnL', async () => {
    // Generate synthetic candles: warmup of 30 candles flat at 100, then drop to 80 (RSI oversold -> buy), then rally to 120 (RSI overbought -> exit)
    const candles: Array<[number, number, number, number, number, number]> = [];
    const baseTime = 1700000000000;

    // 30 warmup candles at price 100
    for (let i = 0; i < 30; i++) {
      candles.push([baseTime + i * 60000, 100, 101, 99, 100, 1000]);
    }
    // 10 declining candles dropping to 70 (triggering oversold enter_long)
    for (let i = 0; i < 10; i++) {
      const p = 100 - (i + 1) * 3;
      candles.push([baseTime + (30 + i) * 60000, p, p + 1, p - 1, p, 1000]);
    }
    // 20 rising candles up to 120 (triggering exit)
    for (let i = 0; i < 20; i++) {
      const p = 70 + (i + 1) * 2.5;
      candles.push([baseTime + (40 + i) * 60000, p, p + 1, p - 1, p, 1000]);
    }

    (ccxtOps.ccxtFetchOhlcv as jest.Mock).mockResolvedValue(candles);

    const req: BacktestRequest = {
      broker: 'binance',
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 100,
      feeRate: 0.001, // 0.1% per trade = 0.20% roundtrip
      slippagePct: 0.05, // 0.05% slippage
      config: {
        type: 'indicator_combination',
        broker: 'binance',
        symbol: 'BTCUSDT',
        interval: '1m',
        quantity: 0.01,
        logic: 'AND',
        indicators: {
          rsi: { period: 5, overbought: 70, oversold: 30 },
        },
        entryConditions: [{ indicator: 'rsi', operator: '<', value: 30 }],
        exitConditions: [{ indicator: 'rsi', operator: '>', value: 70 }],
      },
    };

    const result = await runBacktest(req);

    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.totalFeesPct).toBeGreaterThan(0);
    expect(result.grossPnlPct).toBeDefined();

    // Verify first trade net PnL is less than raw PnL due to fees & slippage
    const trade = result.trades[0];
    if (trade && trade.rawPnlPct != null) {
      expect(trade.pnlPct).toBeLessThan(trade.rawPnlPct);
      expect(trade.feePct).toBeCloseTo(0.25, 2); // 0.20% fee + 0.05% slippage
    }
  });
});
