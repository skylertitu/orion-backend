import Strategy from '../models/Strategy';
import Signal from '../models/Signal';
import Trade from '../models/Trade';
import { tradingEngine } from './TradingEngine';
import { UnifiedOrder, BrokerId } from './engine.types';
import { StrategyConfig as EngineConfig } from './StrategyEngine';
import { SpreadSignal } from '../services/spreadAnalyzer';
import { workerLogger, tradeLogger } from '../utils/logger';
import { assertCanOpen, recordBrokerResult } from '../services/risk.service';
import { signedPnlRatio, signedPnlPct, spreadPnlRatio, spreadPnlPct } from './pnl';
import { StrategyState } from './StrategyState';

export class OrderExecutor {
  roundQty(qty: number): number {
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    if (qty >= 1) return Math.round(qty * 1000) / 1000;
    return Math.round(qty * 1e6) / 1e6;
  }

  async openTrade(
    strategy: Strategy,
    config: EngineConfig,
    side: 'buy' | 'sell',
    price: number,
    states: Map<number, StrategyState>,
    errors: string[],
    fromLucy = false
  ): Promise<void> {
    const state = states.get(strategy.id);
    if (state?.inPosition) return;

    const notional = (config.quantity || 0) * price;
    const allowed = await assertCanOpen({
      notionalUsd: notional,
      symbol: config.symbol,
      strategyId: strategy.id,
      userId: strategy.userId,
      brokerAccountId: config.brokerAccountId,
    });
    if (!allowed.ok) {
      workerLogger.warn(`[Risk] Bloqueo en estrategia #${strategy.id}: ${allowed.reason}`);
      errors.push(`Risk: ${allowed.reason}`);
      return;
    }

    const clientOrderId = `orion_st${strategy.id}_u${strategy.userId}_${Date.now()}`;
    const order: UnifiedOrder = {
      broker: config.broker as BrokerId,
      symbol: config.symbol,
      side,
      quantity: config.quantity,
      userId: strategy.userId,
      brokerAccountId: config.brokerAccountId,
      clientOrderId,
    };

    const result = await tradingEngine.execute(order);
    await recordBrokerResult(result.success, result.error);
    if (!result.success) {
      workerLogger.error(`[OrderExecutor] Error abriendo orden: ${result.error}`);
      errors.push(`Open ${config.symbol}: ${result.error}`);
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
      workerLogger.error(`[OrderExecutor] No se pudo persistir trade abierto: ${err.message}`);
    }

    states.set(strategy.id, {
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
      strategyId: strategy.id,
      side,
      symbol: config.symbol,
      price: result.executedPrice || price,
      ticket: result.ticket,
    });
  }

  async openSpread(
    strategy: Strategy,
    config: EngineConfig,
    signal: SpreadSignal,
    states: Map<number, StrategyState>,
    errors: string[]
  ): Promise<void> {
    const state = states.get(strategy.id);
    if (state?.inPosition) return;
    if (!config.pairSymbol) return;

    const qty1 = this.roundQty(config.quantity);
    const qty2 = this.roundQty((qty1 * signal.price1) / signal.price2);
    if (!qty1 || !qty2) {
      workerLogger.error(`[Spread] Estrategia #${strategy.id}: cantidad inválida qty1=${qty1} qty2=${qty2}`);
      return;
    }

    const allowed = await assertCanOpen({
      notionalUsd: qty1 * signal.price1 + qty2 * signal.price2,
      symbol: `${config.symbol}/${config.pairSymbol}`,
      strategyId: strategy.id,
      userId: strategy.userId,
      brokerAccountId: config.brokerAccountId,
    });
    if (!allowed.ok) {
      workerLogger.warn(`[Risk] Bloqueo spread #${strategy.id}: ${allowed.reason}`);
      errors.push(`Risk: ${allowed.reason}`);
      return;
    }

    const side1: 'buy' | 'sell' = signal.action === 'buy_spread' ? 'buy' : 'sell';
    const side2: 'buy' | 'sell' = side1 === 'buy' ? 'sell' : 'buy';

    const leg1 = await this.executeLeg(strategy, config, config.symbol, side1, qty1);
    if (!leg1.success) {
      workerLogger.error(`[Spread] Estrategia #${strategy.id}: falló pata ${config.symbol}: ${leg1.error}`);
      return;
    }

    const leg2 = await this.executeLeg(strategy, config, config.pairSymbol, side2, qty2);
    if (!leg2.success) {
      workerLogger.error(
        `[Spread] Estrategia #${strategy.id}: falló pata ${config.pairSymbol}: ${leg2.error}. Revirtiendo ${config.symbol}.`
      );
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

    states.set(strategy.id, {
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

  async executeLeg(
    strategy: Strategy,
    config: EngineConfig,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number
  ) {
    const clientOrderId = `orion_st${strategy.id}_${symbol}_${side}_${Date.now()}`;
    const result = await tradingEngine.execute({
      broker: config.broker as BrokerId,
      symbol,
      side,
      quantity,
      userId: strategy.userId,
      brokerAccountId: config.brokerAccountId,
      clientOrderId,
    });
    await recordBrokerResult(result.success, result.error);
    return result;
  }

  async persistOpenTrade(
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
      workerLogger.error(`[OrderExecutor] No se pudo persistir trade abierto: ${err.message}`);
      return undefined;
    }
  }

  async closeTrade(
    strategy: Strategy,
    config: EngineConfig,
    state: StrategyState,
    reason: string,
    states: Map<number, StrategyState>,
    currentPrice: number,
    pairPrice?: number
  ): Promise<void> {
    if (state.pairSymbol && state.pairSide) {
      await this.closeSpread(
        strategy,
        config,
        state,
        reason,
        states,
        currentPrice,
        pairPrice ?? state.pairEntryPrice ?? currentPrice
      );
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
      workerLogger.error(`[OrderExecutor] Error cerrando estrategia #${strategy.id}: ${result.error}`);
      return;
    }

    await this.persistClose(
      state.tradeId,
      currentPrice,
      reason,
      signedPnlRatio(state.side, state.entryPrice, currentPrice),
      result.ticket ?? state.ticket
    );
    states.delete(strategy.id);

    const holdMin = ((Date.now() - state.entryTime) / 60_000).toFixed(1);
    const pnl = signedPnlPct(state.side, state.entryPrice, currentPrice).toFixed(2);
    tradeLogger.info('POSITION_CLOSED', {
      strategyId: strategy.id,
      reason,
      holdMin,
      pnl: `${pnl}%`,
      entry: state.entryPrice,
      exit: currentPrice,
      side: state.side,
      ticket: state.ticket,
    });
  }

  async closeSpread(
    strategy: Strategy,
    config: EngineConfig,
    state: StrategyState,
    reason: string,
    states: Map<number, StrategyState>,
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
        signedPnlRatio(state.side, state.entryPrice, price1),
        leg1.ticket ?? state.ticket
      );
    }
    if (leg2.success) {
      await this.persistClose(
        state.pairTradeId,
        price2,
        reason,
        signedPnlRatio(state.pairSide!, state.pairEntryPrice || price2, price2),
        leg2.ticket ?? state.pairTicket
      );
    }

    if (!leg1.success || !leg2.success) {
      workerLogger.error(
        `[Spread] #${strategy.id}: cierre incompleto leg1=${leg1.success} leg2=${leg2.success} ${leg1.error || ''} ${leg2.error || ''}`
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
      states.set(strategy.id, state);
      return;
    }

    states.delete(strategy.id);
    const pnl = spreadPnlPct(
      state.side,
      state.entryPrice,
      price1,
      state.quantity ?? 0,
      state.pairSide,
      state.pairEntryPrice,
      price2,
      state.pairQuantity ?? 0
    ).toFixed(2);

    tradeLogger.info('SPREAD_CLOSED', {
      strategyId: strategy.id,
      reason,
      pnl: `${pnl}%`,
      leg1: { symbol: config.symbol, exit: price1 },
      leg2: { symbol: state.pairSymbol, exit: price2 },
    });
  }

  async closeLeg(
    strategy: Strategy,
    config: EngineConfig,
    leg: { symbol: string; side: 'buy' | 'sell'; quantity: number; ticket?: string | number; price: number }
  ) {
    const closeSide = leg.side === 'buy' ? 'sell' : 'buy';
    const broker = config.broker as BrokerId;
    let result = leg.ticket
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

    await recordBrokerResult(result.success, result.error);
    return result;
  }

  async persistClose(
    tradeId: number | undefined,
    exitPrice: number,
    reason: string,
    pnlPct: number,
    ticket?: string | number | null
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
      workerLogger.error(`[OrderExecutor] No se pudo persistir cierre de trade: ${err.message}`);
    }
  }
}

export const orderExecutor = new OrderExecutor();
