import { Strategy } from '../models';
import { LUCY_INTEGRATION } from '../integrations/lucy/lucy.pending';
import { getWorkerInstance } from '../engine/workerRegistry';

const ALLOWED_BROKERS = new Set(['binance', 'bybit', 'mt5']);
const ALLOWED_TYPES = new Set(['indicator_combination', 'spread_zscore', 'lucy']);

export interface StrategyUpdateInput {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

function assertOwned(strategy: Strategy | null): Strategy {
  if (!strategy) {
    const err: any = new Error('Estrategia no encontrada');
    err.status = 404;
    throw err;
  }
  return strategy;
}

export function validateStrategyConfig(config: Record<string, unknown> | null | undefined, partial = false): void {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    if (partial) return;
    const err: any = new Error('config es obligatorio');
    err.status = 400;
    throw err;
  }

  if (!partial || config.type !== undefined) {
    if (typeof config.type !== 'string' || !ALLOWED_TYPES.has(config.type)) {
      const err: any = new Error('config.type debe ser indicator_combination, spread_zscore o lucy');
      err.status = 400;
      throw err;
    }
  }

  if (!partial || config.broker !== undefined) {
    if (typeof config.broker !== 'string' || !ALLOWED_BROKERS.has(config.broker)) {
      const err: any = new Error('config.broker debe ser binance, bybit o mt5');
      err.status = 400;
      throw err;
    }
  }

  if (!partial || config.symbol !== undefined) {
    if (typeof config.symbol !== 'string' || !config.symbol.trim()) {
      const err: any = new Error('config.symbol es obligatorio');
      err.status = 400;
      throw err;
    }
  }

  if (config.quantity !== undefined && (typeof config.quantity !== 'number' || config.quantity <= 0)) {
    const err: any = new Error('config.quantity debe ser un número mayor a 0');
    err.status = 400;
    throw err;
  }

  if (config.type === 'spread_zscore' && !partial && !config.pairSymbol) {
    const err: any = new Error('Las estrategias spread_zscore requieren config.pairSymbol');
    err.status = 400;
    throw err;
  }
}

export class StrategyService {
  async createStrategy(userId: number, name: string, description: string, config: object) {
    if (!name?.trim()) {
      const err: any = new Error('El nombre es obligatorio');
      err.status = 400;
      throw err;
    }
    const cfg = (config || {}) as Record<string, unknown>;
    validateStrategyConfig(cfg, false);
    return Strategy.create({
      userId,
      name: name.trim(),
      description: description?.trim() || '',
      config: cfg,
      isActive: false,
    });
  }

  async getUserStrategies(userId: number) {
    return Strategy.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
  }

  async getStrategy(id: number, userId: number) {
    return assertOwned(await Strategy.findOne({ where: { id, userId } }));
  }

  async updateStrategy(id: number, userId: number, input: StrategyUpdateInput) {
    const strategy = assertOwned(await Strategy.findOne({ where: { id, userId } }));

    if (input.name !== undefined) {
      if (!input.name.trim()) {
        const err: any = new Error('El nombre no puede estar vacío');
        err.status = 400;
        throw err;
      }
      strategy.name = input.name.trim();
    }
    if (input.description !== undefined) {
      strategy.description = input.description.trim();
    }
    if (input.config !== undefined) {
      const merged = { ...(strategy.config as Record<string, unknown>), ...input.config };
      validateStrategyConfig(merged, false);
      strategy.config = merged;
    }
    if (input.isActive !== undefined) {
      this.assertCanActivate(strategy, input.isActive);
      strategy.isActive = input.isActive;
    }

    return strategy.save();
  }

  async toggleStrategy(id: number, userId: number) {
    const strategy = assertOwned(await Strategy.findOne({ where: { id, userId } }));
    const next = !strategy.isActive;
    this.assertCanActivate(strategy, next);
    if (!next) {
      await this.releaseWorker(strategy.id);
    }
    strategy.isActive = next;
    return strategy.save();
  }

  async deleteStrategy(id: number, userId: number) {
    const strategy = assertOwned(await Strategy.findOne({ where: { id, userId } }));
    await this.releaseWorker(strategy.id);
    await strategy.destroy();
  }

  private assertCanActivate(strategy: Strategy, activating: boolean) {
    if (!activating) return;
    const type = (strategy.config as Record<string, unknown> | undefined)?.type;
    if (type === 'lucy' && LUCY_INTEGRATION.pending) {
      const err: any = new Error(LUCY_INTEGRATION.reason);
      err.status = 409;
      throw err;
    }
  }

  private async releaseWorker(strategyId: number): Promise<void> {
    const worker = getWorkerInstance();
    if (worker?.pauseStrategy) {
      await worker.pauseStrategy(strategyId);
    }
  }
}
