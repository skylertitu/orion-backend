import { Request, Response } from 'express';
import { walletService } from '../services/wallet.service';
import { getOnChainSolBalance, getSolanaNetworkStatus, requestDevnetAirdrop } from '../services/solana.service';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

function userId(req: Request): number {
  return Number((req as Request & { user?: { id: number } }).user?.id);
}

function fail(res: Response, response: ApiResponse, err: any) {
  logger.error(`[wallet] ${err.message || 'Error de billetera'}`);
  response.success = false;
  response.error = err.message || 'Error de billetera';
  return res.status(err.status || 400).json(response);
}

export const listWallets = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    response.data = await walletService.list(userId(req));
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const getWalletNetwork = async (_req: Request, res: Response) => {
  const response: ApiResponse = { success: true, data: getSolanaNetworkStatus() };
  res.json(response);
};

export const getWalletBalance = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const address = String(req.query.address || '');
    response.data = await getOnChainSolBalance(address);
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const requestWalletAirdrop = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const address = String(req.body?.address || '');
    const amount = Number(req.body?.amount || 1);
    response.data = await requestDevnetAirdrop(address, amount);
    response.message = 'SOL de prueba acreditado en Devnet';
    res.status(201).json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const createWalletNonce = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const address = String(req.body?.address || '');
    if (!address) {
      response.success = false;
      response.error = 'Falta address';
      return res.status(400).json(response);
    }
    response.data = await walletService.createNonce(userId(req), address);
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const linkWallet = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { address, signature, nonce, issuedAt, label } = req.body;
    if (!address || !signature || !nonce || !issuedAt) {
      response.success = false;
      response.error = 'Faltan address, signature, nonce o issuedAt';
      return res.status(400).json(response);
    }
    response.data = await walletService.link(userId(req), {
      address,
      signature,
      nonce,
      issuedAt,
      label,
    });
    response.message = 'Billetera verificada y vinculada';
    res.status(201).json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const setPrimaryWallet = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    response.data = await walletService.setPrimary(userId(req), Number(req.params.id));
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const unlinkWallet = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    await walletService.unlink(userId(req), Number(req.params.id));
    response.message = 'Billetera desvinculada';
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const listTransfers = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    response.data = await walletService.listTransfers(userId(req));
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const requestDeposit = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const amount = Number(req.body.amount);
    response.data = await walletService.requestDeposit(
      userId(req),
      Number(req.params.id),
      amount,
      req.body.asset || 'SOL'
    );
    logger.info(`[wallet] Depósito solicitado user=${userId(req)} amount=${amount} ${req.body.asset || 'SOL'}`);
    res.status(201).json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const requestWithdraw = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const amount = Number(req.body.amount);
    response.data = await walletService.requestWithdraw(
      userId(req),
      Number(req.params.id),
      amount,
      req.body.asset || 'SOL'
    );
    logger.info(`[wallet] Retiro solicitado user=${userId(req)} amount=${amount} ${req.body.asset || 'SOL'}`);
    response.message = 'Retiro solicitado a tu billetera verificada';
    res.status(201).json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};
