import { Request, Response } from 'express';
import { metatraderService } from '../integrations/metatrader/mt.service';
import { accountResolver } from '../engine/AccountResolver';
import { MT5Adapter } from '../engine/adapters/MT5Adapter';
import { ApiResponse } from '../types';

function getUserId(req: Request): number | undefined {
  return (req as Request & { user?: { id: number } }).user?.id;
}

async function resolveUserMtAdapter(req: Request): Promise<MT5Adapter> {
  const userId = getUserId(req);
  if (!userId) {
    const err: any = new Error('No autenticado');
    err.status = 401;
    throw err;
  }
  if (process.env.MT_ENABLED !== 'true') {
    const err: any = new Error('MetaTrader está deshabilitado en el servidor (MT_ENABLED=false).');
    err.status = 503;
    throw err;
  }
  const { adapter } = await accountResolver.resolveAdapter({
    userId,
    brokerId: 'mt5',
    requireActive: true,
  });
  return adapter as MT5Adapter;
}

function fail(res: Response, response: ApiResponse, err: any) {
  const status = err.status || (String(err.message || '').includes('No hay cuenta') ? 400 : 503);
  response.success = false;
  response.error = err.message || 'Error al conectar con MetaTrader';
  return res.status(status).json(response);
}

export const getMtStatus = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    if (process.env.MT_ENABLED !== 'true') {
      response.data = {
        connected: false,
        enabled: false,
        message: 'MetaTrader está deshabilitado en el servidor.',
      };
      return res.json(response);
    }
    const alive = await metatraderService.ping();
    let hasAccount = false;
    const userId = getUserId(req);
    if (userId) {
      try {
        await accountResolver.resolve({ userId, brokerId: 'mt5', requireActive: true });
        hasAccount = true;
      } catch {
        hasAccount = false;
      }
    }
    response.data = {
      connected: alive,
      enabled: true,
      hasAccount,
      message: alive
        ? hasAccount
          ? 'Expert Advisor conectado. Tu cuenta MetaTrader está lista.'
          : 'EA conectado. Conecta una cuenta MetaTrader en Cuentas para operar.'
        : 'MetaTrader no disponible. Verifica que OrionBridge esté corriendo.',
    };
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const getMtSymbols = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const result = await metatraderService.getSymbols();
    if (result.status === 'ERROR') {
      response.success = false;
      response.error = result.error || 'Error al obtener símbolos';
      return res.status(400).json(response);
    }
    response.data = result.symbols || [];
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const getMtPositions = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const adapter = await resolveUserMtAdapter(req);
    response.data = await adapter.getPositions();
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const executeMtOrder = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { symbol, type, lots, sl = 0, tp = 0, comment } = req.body;

    if (!symbol || !type || !lots) {
      response.success = false;
      response.error = 'Faltan campos obligatorios: symbol, type, lots';
      return res.status(400).json(response);
    }

    if (!['buy', 'sell'].includes(String(type).toLowerCase())) {
      response.success = false;
      response.error = 'type debe ser "buy" o "sell"';
      return res.status(400).json(response);
    }

    const adapter = await resolveUserMtAdapter(req);
    const result = await adapter.executeOrder({
      broker: 'mt5',
      symbol: String(symbol).toUpperCase(),
      side: String(type).toLowerCase() as 'buy' | 'sell',
      lot: Number(lots),
      sl: sl ? Number(sl) : undefined,
      tp: tp ? Number(tp) : undefined,
      comment,
      userId: getUserId(req),
    });

    if (!result.success) {
      response.success = false;
      response.error = result.error || 'MetaTrader rechazó la orden';
      return res.status(400).json(response);
    }

    response.data = result;
    res.status(201).json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const closeMtPosition = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const ticket = Number(req.params.ticket);
    if (isNaN(ticket)) {
      response.success = false;
      response.error = 'Ticket inválido';
      return res.status(400).json(response);
    }

    const adapter = await resolveUserMtAdapter(req);
    const result = await adapter.closePosition(ticket);
    if (!result.success) {
      response.success = false;
      response.error = result.error || 'Error al cerrar posición';
      return res.status(400).json(response);
    }

    response.data = result;
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const closeAllMtPositions = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const adapter = await resolveUserMtAdapter(req);
    const result = await adapter.closeOwnedPositions();
    if (!result.success) {
      response.success = false;
      response.error = result.error || 'Error al cerrar posiciones de tu cuenta';
      return res.status(400).json(response);
    }
    response.data = result;
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};
