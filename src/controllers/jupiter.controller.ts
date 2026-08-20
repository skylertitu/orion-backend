import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { TokenPayload } from '../utils/jwt';
import { findJupiterToken, JUPITER_TOKENS } from '../config/jupiterTokens';
import {
  getJupiterPrices,
  getJupiterQuote,
  getJupiterOrder,
  executeJupiterSwap,
  simulateJupiterSwap,
  getJupiterStatus,
  setJupiterApiKey,
} from '../services/jupiter.service';
import { walletService } from '../services/wallet.service';
import { logger } from '../utils/logger';

type AuthRequest = Request & { user?: TokenPayload };

function fail(err: unknown): { message: string; status: number } {
  const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status: number }).status) : 502;
  return {
    message: err instanceof Error ? err.message : 'Error en Jupiter',
    status: Number.isFinite(status) && status >= 400 ? status : 502,
  };
}

export const listJupiterTokens = (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true, data: JUPITER_TOKENS };
  res.json(response);
};

export const jupiterStatus = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    response.data = await getJupiterStatus();
    res.json(response);
  } catch (err: unknown) {
    const { message, status } = fail(err);
    response.success = false;
    response.error = message;
    res.status(status).json(response);
  }
};

export const jupiterPrices = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    response.data = await getJupiterPrices();
    res.json(response);
  } catch (err: unknown) {
    const { message, status } = fail(err);
    response.success = false;
    response.error = message;
    res.status(status).json(response);
  }
};

export const jupiterQuote = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const input = String(req.query.input || req.query.from || 'SOL');
    const output = String(req.query.output || req.query.to || 'USDC');
    const amount = Number(req.query.amount || 1);
    const slippageBps = Number(req.query.slippageBps || 50);
    response.data = await getJupiterQuote(input, output, amount, slippageBps);
    res.json(response);
  } catch (err: unknown) {
    const { message, status } = fail(err);
    response.success = false;
    response.error = message;
    res.status(status).json(response);
  }
};

export const jupiterOrder = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const input = String(req.query.input || req.body?.input || 'SOL');
    const output = String(req.query.output || req.body?.output || 'USDC');
    const amount = Number(req.query.amount || req.body?.amount || 0);
    const taker = String(req.query.taker || req.body?.taker || '');
    const slippageBps = Number(req.query.slippageBps || req.body?.slippageBps || 50);
    response.data = await getJupiterOrder(input, output, amount, taker, slippageBps);
    res.json(response);
  } catch (err: unknown) {
    const { message, status } = fail(err);
    response.success = false;
    response.error = message;
    res.status(status).json(response);
  }
};

export const jupiterExecute = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const signedTransaction = String(req.body?.signedTransaction || '');
    const requestId = String(req.body?.requestId || '');
    const taker = String(req.body?.taker || '');
    const input = String(req.body?.input || 'SOL');
    const output = String(req.body?.output || 'USDC');
    const amount = Number(req.body?.amount || 0);
    const walletLabel = String(req.body?.walletLabel || '');
    const result = await executeJupiterSwap(signedTransaction, requestId);
    const outputToken = findJupiterToken(output);
    const outputAmount =
      result.outputAmountResult && outputToken
        ? Number(result.outputAmountResult) / 10 ** outputToken.decimals
        : undefined;
    let transfer = null;
    if (req.user?.id && taker) {
      try {
        transfer = await walletService.recordSwap(
          req.user.id,
          taker,
          { symbol: input, amount },
          { symbol: output, amount: Number.isFinite(outputAmount) ? outputAmount : undefined },
          result,
          walletLabel
        );
      } catch (err) {
        logger.warn(`[jupiter] swap ejecutado pero no se registró: ${err instanceof Error ? err.message : err}`);
      }
    }
    response.data = { ...result, transfer };
    response.message = result.status === 'Success' ? 'Swap confirmado on-chain' : result.error;
    if (result.status !== 'Success') {
      response.success = false;
      return res.status(400).json(response);
    }
    res.json(response);
  } catch (err: unknown) {
    const { message, status } = fail(err);
    response.success = false;
    response.error = message;
    res.status(status).json(response);
  }
};

export const jupiterSimulate = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const taker = String(req.body?.taker || '');
    const input = String(req.body?.input || 'SOL');
    const output = String(req.body?.output || 'USDC');
    const amount = Number(req.body?.amount || 0);
    const walletLabel = String(req.body?.walletLabel || '');
    if (!taker) {
      response.success = false;
      response.error = 'Conecta una billetera para simular el swap';
      return res.status(400).json(response);
    }
    const result = await simulateJupiterSwap(input, output, amount);
    let transfer = null;
    if (req.user?.id) {
      try {
        transfer = await walletService.recordSwap(
          req.user.id,
          taker,
          { symbol: input, amount },
          { symbol: output, amount: result.quote.outUi },
          result,
          walletLabel
        );
      } catch (err) {
        logger.warn(`[jupiter] simulación ok pero no se registró: ${err instanceof Error ? err.message : err}`);
      }
    }
    response.data = { ...result, transfer };
    response.message = `Swap DEMO simulado en ${result.cluster}`;
    res.json(response);
  } catch (err: unknown) {
    const { message, status } = fail(err);
    response.success = false;
    response.error = message;
    res.status(status).json(response);
  }
};

export const saveJupiterKey = async (req: AuthRequest, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey : '';
    await setJupiterApiKey(apiKey, req.user?.id);
    response.data = await getJupiterStatus();
    response.message = apiKey.trim() ? 'API key de Jupiter guardada' : 'API key de Jupiter eliminada';
    res.json(response);
  } catch (err: unknown) {
    const { message, status } = fail(err);
    response.success = false;
    response.error = message;
    res.status(status).json(response);
  }
};
