import { Request, Response } from 'express';
import { brokerAccountService } from '../services/brokerAccount.service';
import { ApiResponse } from '../types';

function getTokenUser(req: Request) {
  return (req as Request & { user?: { id: number; role?: string } }).user;
}

function assertOwner(req: Request, userId: number, res: Response): boolean {
  const tokenUser = getTokenUser(req);
  if (!tokenUser || Number(tokenUser.id) !== Number(userId) || !Number.isFinite(userId)) {
    const response: ApiResponse = { success: false, error: 'No autorizado' };
    res.status(403).json(response);
    return false;
  }
  return true;
}

export const listBrokerAccounts = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const tokenUser = getTokenUser(req);
    const paramId = req.params.userId ? Number(req.params.userId) : Number(tokenUser?.id);
    if (!assertOwner(req, paramId, res)) return;
    response.data = await brokerAccountService.listUserAccounts(paramId);
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al listar cuentas de broker';
    res.status(400).json(response);
  }
};

export const getBrokerAccount = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = Number(req.params.userId);
    const accountId = Number(req.params.id);
    if (!assertOwner(req, userId, res)) return;
    response.data = await brokerAccountService.getAccount(userId, accountId);
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al obtener cuenta de broker';
    res.status(404).json(response);
  }
};

export const createBrokerAccount = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const { userId } = req.body;
    if (!assertOwner(req, Number(userId), res)) return;
    response.data = await brokerAccountService.createAccount(req.body);
    res.status(201).json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al crear cuenta de broker';
    res.status(400).json(response);
  }
};

export const updateBrokerAccount = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = Number(req.params.userId);
    const accountId = Number(req.params.id);
    if (!assertOwner(req, userId, res)) return;
    response.data = await brokerAccountService.updateAccount(userId, accountId, req.body);
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al actualizar cuenta de broker';
    res.status(400).json(response);
  }
};

export const deleteBrokerAccount = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = Number(req.params.userId);
    const accountId = Number(req.params.id);
    if (!assertOwner(req, userId, res)) return;
    await brokerAccountService.deleteAccount(userId, accountId);
    response.message = 'Cuenta eliminada';
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al eliminar cuenta de broker';
    res.status(400).json(response);
  }
};

export const testBrokerAccountConnection = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = Number(req.params.userId);
    const accountId = Number(req.params.id);
    if (!assertOwner(req, userId, res)) return;
    response.data = await brokerAccountService.testConnection(userId, accountId);
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al probar conexión';
    res.status(400).json(response);
  }
};

export const setPrimaryBrokerAccount = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = Number(req.params.userId);
    const accountId = Number(req.params.id);
    if (!assertOwner(req, userId, res)) return;
    response.data = await brokerAccountService.setPrimary(userId, accountId);
    res.json(response);
  } catch (err: any) {
    response.success = false;
    response.error = err.message || 'Error al marcar cuenta principal';
    res.status(400).json(response);
  }
};
