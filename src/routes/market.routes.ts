import { Router, Request, Response } from 'express';
import { BINANCE_PAIRS, BINANCE_SYMBOLS, isValidBinanceSymbol, normalizeSymbol } from '../config/binance';
import { binancePublicGet } from '../services/binancePublic';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { requireModule } from '../middlewares/module.middleware';

const router = Router();
router.use(requireModule('market'));

const TICKER_TTL_MS = 2000;
let tickerCache: { at: number; data: TickerRow[] } | null = null;

interface TickerRow {
  symbol: string;
  pair: string;
  price: number;
  change: number;
  volume: number;
}

router.get('/pairs', (_req, res) => {
  const response: ApiResponse = { success: true, data: BINANCE_PAIRS };
  res.json(response);
});

router.get('/tickers', async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    if (tickerCache && Date.now() - tickerCache.at < TICKER_TTL_MS) {
      response.data = tickerCache.data;
      return res.json(response);
    }

    const symbols = JSON.stringify(BINANCE_SYMBOLS);
    const raw = await binancePublicGet<Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
    }>>(`/ticker/24hr?symbols=${encodeURIComponent(symbols)}`);

    const data: TickerRow[] = raw.map((d) => ({
      symbol: d.symbol.replace(/USDT$/, ''),
      pair: d.symbol,
      price: parseFloat(d.lastPrice),
      change: parseFloat(d.priceChangePercent),
      volume: parseFloat(d.volume),
    }));

    tickerCache = { at: Date.now(), data };
    response.data = data;
    res.json(response);
  } catch (err: any) {
    logger.error(`[market] Error al obtener tickers: ${err.message || err}`);
    response.success = false;
    response.error = 'No se pudieron obtener precios de mercado';
    res.status(502).json(response);
  }
});

router.get('/klines', async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const symbol = normalizeSymbol(String(req.query.symbol || 'BTCUSDT'));
    const interval = String(req.query.interval || '1h');
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 1000));
    const endTime = req.query.endTime ? Number(req.query.endTime) : NaN;

    if (!isValidBinanceSymbol(symbol)) {
      response.success = false;
      response.error = 'Par no disponible en Binance';
      return res.status(400).json(response);
    }

    const qs = new URLSearchParams({
      symbol,
      interval,
      limit: String(limit),
    });
    if (Number.isFinite(endTime) && endTime > 0) {
      qs.set('endTime', String(Math.floor(endTime)));
    }

    const data = await binancePublicGet(`/klines?${qs.toString()}`);
    response.data = data;
    res.json(response);
  } catch (err: any) {
    logger.error(`[market] Error al obtener klines: ${err.message || err}`);
    response.success = false;
    response.error = 'No se pudieron obtener velas de mercado';
    res.status(502).json(response);
  }
});

router.get('/price', async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const symbol = normalizeSymbol(String(req.query.symbol || 'BTCUSDT'));
    if (!isValidBinanceSymbol(symbol)) {
      response.success = false;
      response.error = 'Par no disponible en Binance';
      return res.status(400).json(response);
    }
    const data = await binancePublicGet<{ symbol: string; price: string }>(
      `/ticker/price?symbol=${encodeURIComponent(symbol)}`
    );
    response.data = { symbol: data.symbol, price: parseFloat(data.price) };
    res.json(response);
  } catch (err: any) {
    logger.error(`[market] Error al obtener precio: ${err.message || err}`);
    response.success = false;
    response.error = 'No se pudo obtener el precio';
    res.status(502).json(response);
  }
});

export default router;
