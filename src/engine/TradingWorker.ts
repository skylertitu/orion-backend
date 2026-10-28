import { Op } from 'sequelize';
import { binanceWs, WsKline } from '../services/binanceWs';
import Strategy from '../models/Strategy';
import { User } from '../models';
import { workerLogger } from '../utils/logger';
import { isPausedByRiskSync } from '../services/risk.service';
import { StrategyConfig as EngineConfig } from './StrategyEngine';
import { StrategyState, WorkerStatus } from './StrategyState';
import { positionReconciler, PositionReconciler } from './PositionReconciler';
import { orderExecutor, OrderExecutor } from './OrderExecutor';
import { StrategyRunner } from './StrategyRunner';

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const extra = err as { parent?: { message?: string }; original?: { message?: string } };
    const nested = extra.parent?.message || extra.original?.message;
    const parts = [err.name !== 'Error' ? err.name : '', err.message, nested].filter(Boolean);
    return [...new Set(parts)].join(': ') || err.stack || 'Error sin mensaje';
  }
  if (typeof err === 'string' && err.trim()) return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export { StrategyState, WorkerStatus };

export class TradingWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cycleMs: number;
  private running = false;
  private cycleCount = 0;
  private lastCycleAt: string | null = null;
  private startTime = 0;
  private errors: string[] = [];
  private states = new Map<number, StrategyState>();
  private subscribedSymbols = new Set<string>();

  private reconciler: PositionReconciler;
  private executor: OrderExecutor;
  private runner: StrategyRunner;

  constructor(cycleSeconds = 30) {
    this.cycleMs = cycleSeconds * 1000;
    this.reconciler = positionReconciler;
    this.executor = orderExecutor;
    this.runner = new StrategyRunner(this.executor);
  }

  start(): void {
    if (this.running) {
      workerLogger.warn('Ya está corriendo.');
      return;
    }
    if (isPausedByRiskSync()) {
      workerLogger.warn('No arranca: pausado por motor de riesgo.');
      return;
    }
    this.running = true;
    this.startTime = Date.now();
    workerLogger.info(`Iniciado. Ciclo cada ${this.cycleMs / 1000}s`);

    binanceWs.on('kline_closed', (kline: WsKline) => {
      this.onKlineClosed(kline);
    });

    void this.bootstrap();
    this.intervalId = setInterval(() => this.runCycle(), this.cycleMs);
  }

  private async bootstrap(): Promise<void> {
    await this.reconciler.restoreOpenTrades(this.states);
    await this.runCycle();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    workerLogger.info('Detenido.');
  }

  getStatus(): WorkerStatus {
    return {
      running: this.running,
      uptime: this.running ? Date.now() - this.startTime : 0,
      cycleCount: this.cycleCount,
      lastCycleAt: this.lastCycleAt,
      activeStrategies: this.states.size,
      openPositions: [...this.states.values()].filter((s) => s.inPosition).length,
      wsConnected: binanceWs.isConnected(),
      errors: this.errors
        .filter((row) => {
          const text = String(row).trim();
          return text.length > 0 && !/^Cycle:\s*(undefined|null)?\s*$/i.test(text);
        })
        .slice(-20),
      strategyStates: [...this.states.entries()].map(([id, s]) => ({
        strategyId: id,
        name: '',
        inPosition: s.inPosition,
        entryPrice: s.entryPrice,
        entryTime: s.entryTime ? new Date(s.entryTime).toISOString() : null,
      })),
    };
  }

  async pauseStrategy(strategyId: number): Promise<void> {
    const state = this.states.get(strategyId);
    const strategy = await Strategy.findByPk(strategyId);
    if (state?.inPosition && strategy) {
      const config = strategy.config as unknown as EngineConfig;
      const interval = config.interval || '1m';
      const price =
        binanceWs.getKlines(config.symbol, interval).at(-1)?.close ??
        binanceWs.getLatestPrice(config.symbol) ??
        state.entryPrice;
      const pairPrice = state.pairSymbol
        ? (binanceWs.getKlines(state.pairSymbol, interval).at(-1)?.close ??
          binanceWs.getLatestPrice(state.pairSymbol) ??
          state.pairEntryPrice ??
          price)
        : undefined;

      await this.executor.closeTrade(strategy, config, state, 'paused', this.states, price, pairPrice);
    }
    this.states.delete(strategyId);
    if (strategy && strategy.isActive) {
      await strategy.update({ isActive: false });
    }
    workerLogger.info(`Estrategia ${strategyId} pausada.`);
  }

  // ── Ciclo principal ────────────────────────────────────────

  private async runCycle(): Promise<void> {
    this.cycleCount++;
    this.lastCycleAt = new Date().toISOString();

    try {
      const adminOnly = process.env.ADMIN_ONLY_TRADING === 'true';
      let eligibleUserIds: number[] = [];

      if (adminOnly) {
        const admins = await User.findAll({
          where: { role: { [Op.in]: ['admin', 'superadmin'] }, blocked: false },
          attributes: ['id'],
        });
        eligibleUserIds = admins.map((row) => row.id);
      } else {
        const users = await User.findAll({
          where: { blocked: false },
          attributes: ['id'],
        });
        eligibleUserIds = users.map((row) => row.id);
      }

      const strategies = eligibleUserIds.length
        ? await Strategy.findAll({ where: { isActive: true, userId: { [Op.in]: eligibleUserIds } } })
        : [];

      for (const strategy of strategies) {
        try {
          await this.runner.processStrategy(
            strategy,
            this.states,
            this.errors,
            (sym, int) => this.ensureSubscribed(sym, int)
          );
        } catch (err: unknown) {
          const text = errorText(err);
          workerLogger.error(`Error en estrategia ${strategy.id} (${strategy.name}): ${text}`);
          this.errors.push(`Strategy ${strategy.id}: ${text}`);
          if (this.errors.length > 100) this.errors = this.errors.slice(-50);
        }
      }

      await this.reconciler.cleanupClosedStates(
        this.states,
        strategies.map((s) => s.id)
      );
    } catch (err: unknown) {
      const text = errorText(err);
      workerLogger.error(`Error general en ciclo: ${text}`);
      if (text && text !== 'Error sin mensaje') {
        this.errors.push(`Cycle: ${text}`);
      }
    }
  }

  private async ensureSubscribed(symbol: string, interval: string): Promise<void> {
    const subKey = `${symbol}_${interval}`;
    if (this.subscribedSymbols.has(subKey)) return;
    await binanceWs.subscribe(symbol, interval);
    this.subscribedSymbols.add(subKey);
    workerLogger.info(`Suscrito a ${symbol} ${interval}`);
  }

  private onKlineClosed(kline: WsKline): void {
    // kline event hook
  }
}
