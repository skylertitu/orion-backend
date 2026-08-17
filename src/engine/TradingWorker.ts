import { binanceWs, WsKline, MarketSnapshot } from '../services/binanceWs';
import { spreadAnalyzer, SpreadConfig, SpreadSignal } from '../services/spreadAnalyzer';
import { lucyOrchestrator } from '../services/lucyOrchestrator.service';
import { LUCY_INTEGRATION } from '../integrations/lucy/lucy.pending';
import { strategyEngine, StrategyConfig as EngineConfig, MarketContext, EvaluatedIndicators } from './StrategyEngine';
import { tradingEngine } from './TradingEngine';
import { UnifiedOrder, BrokerId } from './engine.types';
import Strategy from '../models/Strategy';
import Signal from '../models/Signal';
import Trade from '../models/Trade';
import { workerLogger, tradeLogger } from '../utils/logger';

interface StrategyState {
  strategyId: number;
  inPosition: boolean;
  side: 'buy' | 'sell';
  entryPrice: number;
  entryTime: number;
  ticket?: string | number;
  tradeId?: number;
  quantity?: number;
  pairSymbol?: string;
  pairSide?: 'buy' | 'sell';
  pairEntryPrice?: number;
  pairTicket?: string | number;
  pairTradeId?: number;
  pairQuantity?: number;
}

export interface WorkerStatus {
  running: boolean;
  uptime: number;
  cycleCount: number;
  lastCycleAt: string | null;
  activeStrategies: number;
  openPositions: number;
  wsConnected: boolean;
  errors: string[];
  strategyStates: {
    strategyId: number;
    name: string;
    inPosition: boolean;
    entryPrice: number;
    entryTime: string | null;
  }[];
}

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

  constructor(cycleSeconds = 30) {
    this.cycleMs = cycleSeconds * 1000;
  }

  start(): void {
    if (this.running) { workerLogger.warn('Ya está corriendo.'); return; }
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
    await this.restoreOpenTrades();
    await this.runCycle();
  }

  private async restoreOpenTrades(): Promise<void> {
    try {
      const openTrades = await Trade.findAll({ where: { status: 'open' } });
      const byStrategy = new Map<number, Trade[]>();
      for (const trade of openTrades) {
        if (!trade.strategyId) continue;
        const list = byStrategy.get(trade.strategyId) || [];
        list.push(trade);
        byStrategy.set(trade.strategyId, list);
      }

      for (const [strategyId, trades] of byStrategy) {
        const primary =
          trades.find((t) => (t.raw as any)?.spreadLeg !== 'hedge') || trades[0];
        const hedge = trades.find((t) => (t.raw as any)?.spreadLeg === 'hedge');
        this.states.set(strategyId, {
          strategyId,
          inPosition: true,
          side: primary.side,
          entryPrice: Number(primary.entryPrice),
          entryTime: primary.openedAt.getTime(),
          ticket: primary.ticket || undefined,
          tradeId: primary.id,
          quantity: primary.quantity != null ? Number(primary.quantity) : undefined,
          pairSymbol: hedge?.symbol,
          pairSide: hedge?.side,
          pairEntryPrice: hedge ? Number(hedge.entryPrice) : undefined,
          pairTicket: hedge?.ticket || undefined,
          pairTradeId: hedge?.id,
          pairQuantity: hedge?.quantity != null ? Number(hedge.quantity) : undefined,
        });
      }
      if (openTrades.length) {
        workerLogger.info(`Restauradas ${openTrades.length} posiciones abiertas desde trades`);
      }
    } catch (err: any) {
      workerLogger.error(`No se pudieron restaurar trades: ${err.message}`);
    }
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
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
      errors: this.errors.slice(-20),
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
      const price = binanceWs.getKlines(config.symbol, interval).at(-1)?.close
        ?? binanceWs.getLatestPrice(config.symbol)
        ?? state.entryPrice;
      const pairPrice = state.pairSymbol
        ? (binanceWs.getKlines(state.pairSymbol, interval).at(-1)?.close
          ?? binanceWs.getLatestPrice(state.pairSymbol)
          ?? state.pairEntryPrice
          ?? price)
        : undefined;
      await this.closeTrade(strategy, config, state, 'paused', price, pairPrice);
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
      const strategies = await Strategy.findAll({ where: { isActive: true } });

      for (const strategy of strategies) {
        try {
          await this.processStrategy(strategy);
        } catch (err: any) {
          workerLogger.error(`Error en estrategia ${strategy.id} (${strategy.name}): ${err.message}`);
          this.errors.push(`Strategy ${strategy.id}: ${err.message}`);
          if (this.errors.length > 100) this.errors = this.errors.slice(-50);
        }
      }

      await this.cleanupClosedStates(strategies.map((s) => s.id));
    } catch (err: any) {
      workerLogger.error(`Error general en ciclo: ${err.message}`);
      this.errors.push(`Cycle: ${err.message}`);
    }
  }

  // ── Procesar una estrategia ────────────────────────────────

  private async processStrategy(strategy: Strategy): Promise<void> {
    const config = strategy.config as unknown as EngineConfig;
    if (!config || !config.broker || !config.symbol) return;

    const interval = config.interval || '1m';
    await this.ensureSubscribed(config.symbol, interval);
    if (config.type === 'spread_zscore' && config.pairSymbol) {
      await this.ensureSubscribed(config.pairSymbol, interval);
    }

    if (config.type === 'spread_zscore') {
      await this.processSpreadStrategy(strategy, config);
    } else if (config.type === 'lucy') {
      await this.processLucyStrategy(strategy, config);
    } else {
      await this.processIndicatorStrategy(strategy, config);
    }
  }

  private async ensureSubscribed(symbol: string, interval: string): Promise<void> {
    const subKey = `${symbol}_${interval}`;
    if (this.subscribedSymbols.has(subKey)) return;
    await binanceWs.subscribe(symbol, interval);
    this.subscribedSymbols.add(subKey);
    workerLogger.info(`Suscrito a ${symbol} ${interval}`);
  }

  // ── Estrategia de spread/zscore (legacy) ───────────────────

  private async processSpreadStrategy(strategy: Strategy, config: EngineConfig): Promise<void> {
    if (!config.pairSymbol) return;

    const spreadConfig: SpreadConfig = {
      symbol: config.symbol,
      pairSymbol: config.pairSymbol,
      lookbackPeriod: config.lookback || 100,
      zscoreEntry: config.zscore_entry || 2.0,
      zscoreExit: config.zscore_exit || 0.5,
      klinesInterval: config.interval || '1m',
    };

    const signal = await spreadAnalyzer.analyze(spreadConfig);
    const state = this.states.get(strategy.id);

    await this.logSignal(strategy, {
      action: signal.action,
      symbol: `${config.symbol}/${config.pairSymbol}`,
      confidence: Math.min(1, Math.abs(signal.zScore) / (config.zscore_entry || 2)),
      reason: `z=${signal.zScore} spread=${signal.spread.toFixed(4)}`,
      price: signal.price1,
    }, { zScore: signal.zScore, spread: signal.spread } as any);

    workerLogger.info(
      `#${strategy.id} ${strategy.name} | SPREAD ${config.symbol}/${config.pairSymbol} | z=${signal.zScore} | action=${signal.action} | pos=${state?.inPosition ? 'OPEN' : 'NONE'}`
    );

    if (state?.inPosition) {
      const opposite =
        (state.side === 'buy' && signal.action === 'sell_spread') ||
        (state.side === 'sell' && signal.action === 'buy_spread');
      if (signal.action === 'close' || opposite) {
        await this.closeTrade(strategy, config, state, 'signal_exit', signal.price1, signal.price2);
      } else if (config.stop_loss_pct || config.take_profit_pct) {
        await this.checkSpreadRiskLimits(strategy, config, state, signal.price1, signal.price2);
      }
    } else if (signal.action === 'buy_spread' || signal.action === 'sell_spread') {
      await this.openSpread(strategy, config, signal);
    }
  }

  // ── Estrategia Lucy (PENDIENTE: SDK/API aún no conectada) ──

  private async processLucyStrategy(strategy: Strategy, config: EngineConfig): Promise<void> {
    if (LUCY_INTEGRATION.pending) {
      workerLogger.info(`#${strategy.id} ${strategy.name} | LUCY pendiente — ${LUCY_INTEGRATION.reason}`);
      return;
    }

    const klines = binanceWs.getKlines(config.symbol, config.interval || '1m');
    if (klines.length < 30) return;

    const indicators = strategyEngine.computeIndicators(
      klines.map((k) => k.close),
      config.indicators || {}
    );

    const result = await lucyOrchestrator.runPipeline(strategy, klines, indicators);
    const state = this.states.get(strategy.id);

    workerLogger.info(
      `#${strategy.id} ${strategy.name} | LUCY ${config.symbol} | action=${result.action} | conf=${result.confidence.toFixed(2)} | pos=${state?.inPosition ? 'OPEN' : 'NONE'} | ${result.reason}`
    );

    const ctx: MarketContext = {
      symbol: config.symbol,
      interval: config.interval || '1m',
      klines,
      closes: klines.map((k) => k.close),
      highs: klines.map((k) => k.high),
      lows: klines.map((k) => k.low),
      volumes: klines.map((k) => k.volume),
      currentPrice: result.price,
      timestamp: Date.now(),
    };

    if (!lucyOrchestrator.shouldAutoExecute(config, result)) {
      if (state?.inPosition && result.action === 'exit') {
        await this.closeTrade(strategy, config, state, result.reason, ctx.currentPrice);
      }
      return;
    }

    if (state?.inPosition) {
      const opposite =
        (state.side === 'buy' && result.action === 'enter_short') ||
        (state.side === 'sell' && result.action === 'enter_long');
      if (result.action === 'exit' || opposite) {
        await this.closeTrade(strategy, config, state, result.reason, ctx.currentPrice);
      } else if (config.stop_loss_pct || config.take_profit_pct) {
        await this.checkRiskLimits(strategy, config, state, ctx.currentPrice);
      }
    } else if (result.action === 'enter_long' || result.action === 'enter_short') {
      const side = result.action === 'enter_long' ? 'buy' : 'sell';
      await this.openTrade(strategy, config, side, ctx.currentPrice, true);
    }
  }

  // ── Estrategia de indicadores (nueva) ──────────────────────

  private async processIndicatorStrategy(strategy: Strategy, config: EngineConfig): Promise<void> {
    const klines = binanceWs.getKlines(config.symbol, config.interval || '1m');
    if (klines.length < 30) return;

    const ctx: MarketContext = {
      symbol: config.symbol,
      interval: config.interval || '1m',
      klines,
      closes: klines.map((k) => k.close),
      highs: klines.map((k) => k.high),
      lows: klines.map((k) => k.low),
      volumes: klines.map((k) => k.volume),
      currentPrice: klines[klines.length - 1].close,
      timestamp: Date.now(),
    };

    const indicators = strategyEngine.computeIndicators(ctx.closes, config.indicators || {});
    const signal = strategyEngine.evaluate(strategy.id, ctx, config, indicators);
    const state = this.states.get(strategy.id);

    await this.logSignal(strategy, signal, indicators);

    workerLogger.info(
      `#${strategy.id} ${strategy.name} | ${config.symbol} | action=${signal.action} | conf=${signal.confidence.toFixed(2)} | pos=${state?.inPosition ? 'OPEN' : 'NONE'} | ${signal.reason}`
    );

    if (state?.inPosition) {
      if (signal.action === 'exit') {
        await this.closeTrade(strategy, config, state, signal.reason, ctx.currentPrice);
      } else if (config.stop_loss_pct || config.take_profit_pct) {
        await this.checkRiskLimits(strategy, config, state, ctx.currentPrice);
      }
    } else if (signal.action === 'enter_long' || signal.action === 'enter_short') {
      const side = signal.action === 'enter_long' ? 'buy' : 'sell';
      await this.openTrade(strategy, config, side, ctx.currentPrice);
    }
  }

  // ── Abrir trade ────────────────────────────────────────────

  private async openTrade(
    strategy: Strategy,
    config: EngineConfig,
    side: 'buy' | 'sell',
    price: number,
    fromLucy = false
  ): Promise<void> {
    const state = this.states.get(strategy.id);
    if (state?.inPosition) return;

    const order: UnifiedOrder = {
      broker: config.broker as BrokerId,
      symbol: config.symbol,
      side,
      quantity: config.quantity,
      userId: strategy.userId,
      brokerAccountId: config.brokerAccountId,
    };

    const result = await tradingEngine.execute(order);
    if (!result.success) {
      workerLogger.error(`Error abriendo: ${result.error}`);
      return;
    }

    const lastSignal = await Signal.findOne({
      where: {
        strategyId: strategy.id,
        userId: strategy.userId,
        source: fromLucy ? 'lucy' : 'strategy',
        executed: false,
      },
      order: [['createdAt', 'DESC']],
    });
    if (lastSignal) await lastSignal.update({ executed: true });

    let tradeId: number | undefined;
    try {
      const trade = await Trade.create({
        userId: strategy.userId,
        strategyId: strategy.id,
        brokerAccountId: config.brokerAccountId ?? null,
        signalId: lastSignal?.id ?? null,
        broker: config.broker,
        symbol: config.symbol,
        side,
        quantity: config.quantity ?? null,
        ticket: result.ticket != null ? String(result.ticket) : null,
        status: 'open',
        entryPrice: result.executedPrice || price,
        openedAt: new Date(),
        raw: result.raw || null,
      });
      tradeId = trade.id;
    } catch (err: any) {
      workerLogger.error(`No se pudo persistir trade abierto: ${err.message}`);
    }

    this.states.set(strategy.id, {
      strategyId: strategy.id,
      inPosition: true,
      side,
      entryPrice: result.executedPrice || price,
      entryTime: Date.now(),
      ticket: result.ticket,
      tradeId,
      quantity: config.quantity,
    });

    tradeLogger.info('POSITION_OPENED', {
      strategyId: strategy.id, side, symbol: config.symbol, price: result.executedPrice || price,
      ticket: result.ticket,
    });
  }

  private roundQty(qty: number): number {
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    if (qty >= 1) return Math.round(qty * 1000) / 1000;
    return Math.round(qty * 1e6) / 1e6;
  }

  private async openSpread(strategy: Strategy, config: EngineConfig, signal: SpreadSignal): Promise<void> {
    const state = this.states.get(strategy.id);
    if (state?.inPosition) return;
    if (!config.pairSymbol) return;

    const qty1 = this.roundQty(config.quantity);
    const qty2 = this.roundQty((qty1 * signal.price1) / signal.price2);
    if (!qty1 || !qty2) {
      workerLogger.error(`Spread ${strategy.id}: cantidad inválida qty1=${qty1} qty2=${qty2}`);
      return;
    }

    const side1: 'buy' | 'sell' = signal.action === 'buy_spread' ? 'buy' : 'sell';
    const side2: 'buy' | 'sell' = side1 === 'buy' ? 'sell' : 'buy';

    const leg1 = await this.executeLeg(strategy, config, config.symbol, side1, qty1);
    if (!leg1.success) {
      workerLogger.error(`Spread ${strategy.id}: falló pata ${config.symbol}: ${leg1.error}`);
      return;
    }

    const leg2 = await this.executeLeg(strategy, config, config.pairSymbol, side2, qty2);
    if (!leg2.success) {
      workerLogger.error(`Spread ${strategy.id}: falló pata ${config.pairSymbol}: ${leg2.error}. Revirtiendo ${config.symbol}.`);
      await this.closeLeg(strategy, config, {
        symbol: config.symbol,
        side: side1,
        quantity: qty1,
        ticket: leg1.ticket,
        price: signal.price1,
      });
      return;
    }

    const tradeId = await this.persistOpenTrade(strategy, config, {
      symbol: config.symbol,
      side: side1,
      quantity: qty1,
      ticket: leg1.ticket,
      price: leg1.executedPrice || signal.price1,
      raw: { ...(leg1.raw || {}), spreadLeg: 'primary', pairSymbol: config.pairSymbol },
    });
    const pairTradeId = await this.persistOpenTrade(strategy, config, {
      symbol: config.pairSymbol,
      side: side2,
      quantity: qty2,
      ticket: leg2.ticket,
      price: leg2.executedPrice || signal.price2,
      raw: { ...(leg2.raw || {}), spreadLeg: 'hedge', pairSymbol: config.symbol },
    });

    this.states.set(strategy.id, {
      strategyId: strategy.id,
      inPosition: true,
      side: side1,
      entryPrice: leg1.executedPrice || signal.price1,
      entryTime: Date.now(),
      ticket: leg1.ticket,
      tradeId,
      quantity: qty1,
      pairSymbol: config.pairSymbol,
      pairSide: side2,
      pairEntryPrice: leg2.executedPrice || signal.price2,
      pairTicket: leg2.ticket,
      pairTradeId,
      pairQuantity: qty2,
    });

    tradeLogger.info('SPREAD_OPENED', {
      strategyId: strategy.id,
      action: signal.action,
      zScore: signal.zScore,
      leg1: { symbol: config.symbol, side: side1, qty: qty1, ticket: leg1.ticket },
      leg2: { symbol: config.pairSymbol, side: side2, qty: qty2, ticket: leg2.ticket },
    });
  }

  private async executeLeg(
    strategy: Strategy,
    config: EngineConfig,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number
  ) {
    return tradingEngine.execute({
      broker: config.broker as BrokerId,
      symbol,
      side,
      quantity,
      userId: strategy.userId,
      brokerAccountId: config.brokerAccountId,
    });
  }

  private async persistOpenTrade(
    strategy: Strategy,
    config: EngineConfig,
    leg: {
      symbol: string;
      side: 'buy' | 'sell';
      quantity: number;
      ticket?: string | number;
      price: number;
      raw?: Record<string, unknown> | null;
    }
  ): Promise<number | undefined> {
    try {
      const trade = await Trade.create({
        userId: strategy.userId,
        strategyId: strategy.id,
        brokerAccountId: config.brokerAccountId ?? null,
        broker: config.broker,
        symbol: leg.symbol,
        side: leg.side,
        quantity: leg.quantity,
        ticket: leg.ticket != null ? String(leg.ticket) : null,
        status: 'open',
        entryPrice: leg.price,
        openedAt: new Date(),
        raw: leg.raw || null,
      });
      return trade.id;
    } catch (err: any) {
      workerLogger.error(`No se pudo persistir trade abierto: ${err.message}`);
      return undefined;
    }
  }

  // ── Cerrar trade ───────────────────────────────────────────

  private async closeTrade(
    strategy: Strategy,
    config: EngineConfig,
    state: StrategyState,
    reason: string,
    currentPrice: number,
    pairPrice?: number
  ): Promise<void> {
    if (state.pairSymbol && state.pairSide) {
      await this.closeSpread(strategy, config, state, reason, currentPrice, pairPrice ?? state.pairEntryPrice ?? currentPrice);
      return;
    }

    const result = await this.closeLeg(strategy, config, {
      symbol: config.symbol,
      side: state.side,
      quantity: state.quantity ?? config.quantity,
      ticket: state.ticket,
      price: currentPrice,
    });

    if (!result.success) {
      workerLogger.error(`Error cerrando estrategia ${strategy.id}: ${result.error}`);
      return;
    }

    await this.persistClose(state.tradeId, currentPrice, reason, this.signedPnlPct(state.side, state.entryPrice, currentPrice), result.ticket ?? state.ticket);
    this.states.delete(strategy.id);

    const holdMin = ((Date.now() - state.entryTime) / 60_000).toFixed(1);
    const pnl = (this.signedPnlPct(state.side, state.entryPrice, currentPrice) * 100).toFixed(2);
    tradeLogger.info('POSITION_CLOSED', {
      strategyId: strategy.id, reason, holdMin, pnl: pnl + '%',
      entry: state.entryPrice, exit: currentPrice, side: state.side, ticket: state.ticket,
    });
  }

  private async closeSpread(
    strategy: Strategy,
    config: EngineConfig,
    state: StrategyState,
    reason: string,
    price1: number,
    price2: number
  ): Promise<void> {
    const leg1 = await this.closeLeg(strategy, config, {
      symbol: config.symbol,
      side: state.side,
      quantity: state.quantity ?? config.quantity,
      ticket: state.ticket,
      price: price1,
    });
    const leg2 = await this.closeLeg(strategy, config, {
      symbol: state.pairSymbol!,
      side: state.pairSide!,
      quantity: state.pairQuantity ?? config.quantity,
      ticket: state.pairTicket,
      price: price2,
    });

    if (leg1.success) {
      await this.persistClose(
        state.tradeId,
        price1,
        reason,
        this.signedPnlPct(state.side, state.entryPrice, price1),
        leg1.ticket ?? state.ticket
      );
    }
    if (leg2.success) {
      await this.persistClose(
        state.pairTradeId,
        price2,
        reason,
        this.signedPnlPct(state.pairSide!, state.pairEntryPrice || price2, price2),
        leg2.ticket ?? state.pairTicket
      );
    }

    if (!leg1.success || !leg2.success) {
      workerLogger.error(
        `Spread ${strategy.id}: cierre incompleto leg1=${leg1.success} leg2=${leg2.success} ${leg1.error || ''} ${leg2.error || ''}`
      );
      if (leg1.success) {
        state.ticket = undefined;
        state.tradeId = undefined;
      }
      if (leg2.success) {
        state.pairTicket = undefined;
        state.pairTradeId = undefined;
        state.pairSymbol = undefined;
      }
      this.states.set(strategy.id, state);
      return;
    }

    this.states.delete(strategy.id);
    const pnl = (this.spreadPnlPct(state, price1, price2) * 100).toFixed(2);
    tradeLogger.info('SPREAD_CLOSED', {
      strategyId: strategy.id, reason, pnl: pnl + '%',
      leg1: { symbol: config.symbol, exit: price1 },
      leg2: { symbol: state.pairSymbol, exit: price2 },
    });
  }

  private async closeLeg(
    strategy: Strategy,
    config: EngineConfig,
    leg: { symbol: string; side: 'buy' | 'sell'; quantity: number; ticket?: string | number; price: number }
  ) {
    const closeSide = leg.side === 'buy' ? 'sell' : 'buy';
    const broker = config.broker as BrokerId;
    const simulated = String(leg.ticket || '').startsWith('SIMULATED-');

    let result = leg.ticket && !simulated
      ? await tradingEngine.closePosition(broker, leg.ticket, strategy.userId, config.brokerAccountId)
      : null;

    if (!result?.success) {
      result = await tradingEngine.execute({
        broker,
        symbol: leg.symbol,
        side: closeSide,
        quantity: leg.quantity,
        userId: strategy.userId,
        brokerAccountId: config.brokerAccountId,
      });
    }
    return result;
  }

  private async persistClose(
    tradeId: number | undefined,
    exitPrice: number,
    reason: string,
    pnlPct: number,
    ticket?: string | number
  ): Promise<void> {
    if (!tradeId) return;
    try {
      await Trade.update(
        {
          status: 'closed',
          exitPrice,
          closedAt: new Date(),
          closeReason: reason,
          pnlPct,
          ticket: ticket != null ? String(ticket) : null,
        },
        { where: { id: tradeId } }
      );
    } catch (err: any) {
      workerLogger.error(`No se pudo persistir cierre de trade: ${err.message}`);
    }
  }

  private signedPnlPct(side: 'buy' | 'sell', entryPrice: number, currentPrice: number): number {
    if (!entryPrice) return 0;
    const raw = (currentPrice - entryPrice) / entryPrice;
    return side === 'sell' ? -raw : raw;
  }

  private spreadPnlPct(state: StrategyState, price1: number, price2: number): number {
    const qty1 = state.quantity ?? 0;
    const qty2 = state.pairQuantity ?? 0;
    const n1 = qty1 * state.entryPrice;
    const n2 = qty2 * (state.pairEntryPrice || 0);
    const p1 = this.signedPnlPct(state.side, state.entryPrice, price1) * n1;
    const p2 = state.pairSide && state.pairEntryPrice
      ? this.signedPnlPct(state.pairSide, state.pairEntryPrice, price2) * n2
      : 0;
    const denom = n1 + n2;
    return denom ? (p1 + p2) / denom : 0;
  }

  // ── Risk limits ────────────────────────────────────────────

  private async checkRiskLimits(strategy: Strategy, config: EngineConfig, state: StrategyState, currentPrice: number): Promise<void> {
    const pnlPct = this.signedPnlPct(state.side, state.entryPrice, currentPrice);

    if (config.stop_loss_pct && pnlPct < -config.stop_loss_pct) {
      tradeLogger.info('STOP_LOSS', { strategyId: strategy.id, pnl: (pnlPct * 100).toFixed(2) + '%' });
      await this.closeTrade(strategy, config, state, 'stop_loss', currentPrice);
    } else if (config.take_profit_pct && pnlPct > config.take_profit_pct) {
      tradeLogger.info('TAKE_PROFIT', { strategyId: strategy.id, pnl: (pnlPct * 100).toFixed(2) + '%' });
      await this.closeTrade(strategy, config, state, 'take_profit', currentPrice);
    }
  }

  private async checkSpreadRiskLimits(
    strategy: Strategy,
    config: EngineConfig,
    state: StrategyState,
    price1: number,
    price2: number
  ): Promise<void> {
    const pnlPct = this.spreadPnlPct(state, price1, price2);
    if (config.stop_loss_pct && pnlPct < -config.stop_loss_pct) {
      tradeLogger.info('STOP_LOSS', { strategyId: strategy.id, pnl: (pnlPct * 100).toFixed(2) + '%' });
      await this.closeTrade(strategy, config, state, 'stop_loss', price1, price2);
    } else if (config.take_profit_pct && pnlPct > config.take_profit_pct) {
      tradeLogger.info('TAKE_PROFIT', { strategyId: strategy.id, pnl: (pnlPct * 100).toFixed(2) + '%' });
      await this.closeTrade(strategy, config, state, 'take_profit', price1, price2);
    }
  }

  // ── Log de señales a DB ────────────────────────────────────

  private async logSignal(strategy: Strategy, signal: any, indicators: EvaluatedIndicators): Promise<void> {
    if (signal.action === 'hold') return;
    try {
      await Signal.create({
        strategyId: strategy.id,
        userId: strategy.userId,
        symbol: signal.symbol || (strategy.config as any)?.symbol || '',
        action: signal.action,
        confidence: signal.confidence || 0,
        reason: signal.reason || '',
        indicators,
        price: signal.price || 0,
        executed: false,
        source: 'strategy',
      });
    } catch (err: any) {
      workerLogger.error(`Error guardando señal: ${err.message}`);
    }
  }

  // ── Kline cerrada callback ─────────────────────────────────

  private onKlineClosed(kline: WsKline): void {
    this.emit('kline_closed', kline);
  }

  // ── Cleanup ────────────────────────────────────────────────

  private async cleanupClosedStates(activeIds: number[]): Promise<void> {
    for (const [id, state] of this.states) {
      if (activeIds.includes(id)) continue;
      if (state.inPosition) {
        workerLogger.warn(`Estrategia ${id} inactiva con posición abierta; se conserva el estado hasta cerrar.`);
        continue;
      }
      this.states.delete(id);
      workerLogger.info(`Estado limpiado para estrategia ${id}`);
    }
  }

  private emit(_event: string, _data: any): void {
    // placeholder for event emitter
  }
}
