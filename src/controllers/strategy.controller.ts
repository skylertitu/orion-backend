import { Request, Response } from 'express';
import { StrategyService } from '../services/strategy.service';
import { ApiResponse } from '../types';

const strategyService = new StrategyService();

function tokenUserId(req: Request): number {
  return Number((req as Request & { user?: { id: number } }).user?.id);
}

function fail(res: Response, response: ApiResponse, err: any) {
  response.success = false;
  response.error = err.message || 'Error en estrategias';
  return res.status(err.status || 400).json(response);
}

export const getStrategies = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const strategies = await strategyService.getUserStrategies(tokenUserId(req));
    response.data = strategies;
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const getStrategy = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const id = Number(req.params.id);
    if (!id) {
      response.success = false;
      response.error = 'ID inválido';
      return res.status(400).json(response);
    }
    response.data = await strategyService.getStrategy(id, tokenUserId(req));
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const createStrategy = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const userId = tokenUserId(req);
    const { name, description, config } = req.body;
    if (req.body.userId && Number(req.body.userId) !== userId) {
      response.success = false;
      response.error = 'No autorizado';
      return res.status(403).json(response);
    }
    const strategy = await strategyService.createStrategy(userId, name, description, config);
    response.data = strategy;
    res.status(201).json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const updateStrategy = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const id = Number(req.params.id);
    if (!id) {
      response.success = false;
      response.error = 'ID inválido';
      return res.status(400).json(response);
    }
    const { name, description, config, isActive } = req.body;
    response.data = await strategyService.updateStrategy(id, tokenUserId(req), {
      name,
      description,
      config,
      isActive,
    });
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const toggleStrategy = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const id = Number(req.params.id);
    const userId = tokenUserId(req);
    if (req.body?.userId && Number(req.body.userId) !== userId) {
      response.success = false;
      response.error = 'No autorizado';
      return res.status(403).json(response);
    }
    response.data = await strategyService.toggleStrategy(id, userId);
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};

export const deleteStrategy = async (req: Request, res: Response) => {
  const response: ApiResponse = { success: true };
  try {
    const id = Number(req.params.id);
    if (!id) {
      response.success = false;
      response.error = 'ID inválido';
      return res.status(400).json(response);
    }
    await strategyService.deleteStrategy(id, tokenUserId(req));
    response.message = 'Estrategia eliminada';
    res.json(response);
  } catch (err: any) {
    return fail(res, response, err);
  }
};
