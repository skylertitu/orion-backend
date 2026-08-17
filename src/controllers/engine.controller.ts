import { Request, Response } from 'express';
import { tradingEngine } from '../engine/TradingEngine';
import { BrokerId, UnifiedOrder } from '../engine/engine.types';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

function getUserId(req: Request): number | undefined {
  return (req as Request & { user?: { id: number } }).user?.id;
}

export const getBrokers = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const statuses = await tradingEngine.getBrokerStatuses();
    response.data = statuses;
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message;
    res.status(500).json(response);
  }
};

export const executeOrder = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = getUserId(req);
    const { broker, symbol, side, quantity, lot, sl, tp, comment, brokerAccountId } = req.body;

    if (!broker || !symbol || !side) {
      response.success = false;
      response.error = 'Faltan campos obligatorios: broker, symbol, side';
      return res.status(400).json(response);
    }
    if (!['buy', 'sell'].includes(side)) {
      response.success = false;
      response.error = '"side" debe ser "buy" o "sell"';
      return res.status(400).json(response);
    }
    if (!quantity && !lot) {
      response.success = false;
      response.error = 'Debes especificar "quantity" (crypto) o "lot" (forex/CFD)';
      return res.status(400).json(response);
    }

    const order: UnifiedOrder = {
      broker: broker as BrokerId,
      symbol,
      side,
      quantity: quantity ? Number(quantity) : undefined,
      lot: lot ? Number(lot) : undefined,
      sl: sl ? Number(sl) : undefined,
      tp: tp ? Number(tp) : undefined,
      comment,
      userId,
      brokerAccountId: brokerAccountId ? Number(brokerAccountId) : undefined,
    };

    const result = await tradingEngine.execute(order);

    if (!result.success) {
      logger.error(
        `[engine] Error al enviar orden ${order.side} ${order.symbol} en ${order.broker}: ${result.error}`
      );
      response.success = false;
      response.error = result.error;
      response.data = result;
      return res.status(400).json(response);
    }

    logger.info(
      `[engine] Orden enviada ${order.side} ${order.symbol} en ${order.broker} ticket=${result.ticket ?? '-'}`
    );
    response.data = result;
    res.status(201).json(response);
  } catch (err: any) {
    logger.error(`[engine] Error al enviar orden: ${err.message || err}`);
    response.success = false;
    response.error = err.message;
    res.status(500).json(response);
  }
};

export const getPositions = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const broker = req.query.broker as BrokerId | undefined;
    const brokerAccountId = req.query.brokerAccountId
      ? Number(req.query.brokerAccountId)
      : undefined;
    const userId = getUserId(req);

    const positions = broker
      ? await tradingEngine.getPositions(broker, userId, brokerAccountId)
      : await tradingEngine.getAllPositions(userId);

    response.data = positions;
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message;
    res.status(500).json(response);
  }
};

export const closePosition = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { broker, ticket } = req.params;
    const brokerAccountId = req.query.brokerAccountId
      ? Number(req.query.brokerAccountId)
      : undefined;
    const userId = getUserId(req);

    const result = await tradingEngine.closePosition(
      broker as BrokerId,
      ticket as string,
      userId,
      brokerAccountId
    );

    if (!result.success) {
      logger.error(`[engine] Error al cerrar posición ${broker} ticket=${ticket}: ${result.error}`);
      response.success = false;
      response.error = result.error;
      return res.status(400).json(response);
    }

    logger.info(`[engine] Posición cerrada ${broker} ticket=${ticket}`);
    response.data = result;
    res.json(response);
  } catch (err: any) {
    logger.error(`[engine] Error al cerrar posición: ${err.message || err}`);
    response.success = false;
    response.error = err.message;
    res.status(500).json(response);
  }
};

export const getPrice = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const broker = req.query.broker as BrokerId;
    const symbol = req.query.symbol as string;
    const brokerAccountId = req.query.brokerAccountId
      ? Number(req.query.brokerAccountId)
      : undefined;
    const userId = getUserId(req);

    if (!broker || !symbol) {
      response.success = false;
      response.error = 'Parámetros requeridos: broker, symbol';
      return res.status(400).json(response);
    }

    const price = await tradingEngine.getPrice(broker, symbol, userId, brokerAccountId);
    response.data = { broker, symbol, price, brokerAccountId: brokerAccountId || null };
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message;
    res.status(500).json(response);
  }
};
