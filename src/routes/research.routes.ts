import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireCapability } from '../middlewares/plan.middleware';
import { ApiResponse } from '../types';
import { runBacktest, type BacktestRequest } from '../research/backtest.service';
import type { StrategyConfig } from '../engine/StrategyEngine';
import { ccxtStatus } from '../engine/ccxt/ccxtConfig';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);
router.use(requireCapability('strategies_auto'));

router.get('/status', (_req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      ccxt: ccxtStatus(),
      backtest: true,
      note: 'Backtest es dry-run sobre OHLCV; no envía órdenes al exchange.',
    },
  };
  res.json(response);
});

router.post('/backtest', async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const body = req.body as Partial<BacktestRequest> & { config?: StrategyConfig };
    if (!body?.config || !body?.symbol) {
      response.success = false;
      response.error = 'Indica symbol y config de estrategia';
      return res.status(400).json(response);
    }

    const result = await runBacktest({
      broker: body.broker === 'bybit' ? 'bybit' : 'binance',
      symbol: String(body.symbol),
      interval: body.interval ? String(body.interval) : undefined,
      limit: body.limit != null ? Number(body.limit) : undefined,
      config: body.config,
    });

    response.data = result;
    res.json(response);
  } catch (err: any) {
    logger.warn(`[research] backtest: ${err?.message || err}`);
    response.success = false;
    response.error = err?.message || 'No se pudo ejecutar el backtest';
    res.status(400).json(response);
  }
});

export default router;
