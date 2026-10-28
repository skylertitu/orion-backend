import Strategy from '../models/Strategy';
import Signal from '../models/Signal';
import { binanceWs } from '../services/binanceWs';
import { spreadAnalyzer, SpreadConfig } from '../services/spreadAnalyzer';
import { lucyOrchestrator } from '../services/lucyOrchestrator.service';
import { LUCY_INTEGRATION } from '../integrations/lucy/lucy.pending';
import {
  strategyEngine,
  StrategyConfig as EngineConfig,
  MarketContext,
  EvaluatedIndicators,
} from './StrategyEngine';
import { workerLogger, tradeLogger } from '../utils/logger';
import { signedPnlPct, spreadPnlPct, evaluateRiskLimits } from './pnl';
import { StrategyState } from './StrategyState';
import { OrderExecutor } from './OrderExecutor';

export class StrategyRunner {
  constructor(private orderExecutor: OrderExecutor) {}

  async processStrategy(
    strategy: Strategy,
    states: Map<number, StrategyState>,
    errors: string[],
    ensureSubscribed: (symbol: string, interval: string) => Promise<void>
  ): Promise<void> {
    const config = strategy.config as unknown as EngineConfig;
    if (!config || !config.broker || !config.symbol) return;

    const interval = config.interval || '1m';
    await ensureSubscribed(config.symbol, interval);
    if (config.type === 'spread_zscore' && config.pairSymbol) {
      await ensureSubscribed(config.pairSymbol, interval);
    }

    if (config.type === 'spread_zscore') {
      await this.processSpreadStrategy(strategy, config, states, errors);
    } else if (config.type === 'lucy') {
      await this.processLucyStrategy(strategy, config, states, errors);
    } else {
      await this.processIndicatorStrategy(strategy, config, states, errors);
    }
  }

  async processSpreadStrategy(
    strategy: Strategy,
    config: EngineConfig,
    states: Map<number, StrategyState>,
    errors: string[]
  ): Promise<void> {
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
    const state = states.get(strategy.id);

    workerLogger.info(
      `#${strategy.id} ${strategy.name} | SPREAD ${config.symbol}/${config.pairSymbol} | zScore=${signal.zScore.toFixed(2)} | action=${signal.action} | pos=${state?.inPosition ? 'OPEN' : 'NONE'}`
    );

    if (state?.inPosition) {
      const opposite =
        (state.side === 'buy' && signal.action === 'sell_spread') ||
        (state.side === 'sell' && signal.action === 'buy_spread');
      if (signal.action === 'close' || opposite) {
        await this.orderExecutor.closeTrade(
          strategy,
          config,
          state,
          'signal_exit',
          states,
          signal.price1,
          signal.price2
        );
      } else if (config.stop_loss_pct || config.take_profit_pct) {
        await this.checkSpreadRiskLimits(strategy, config, state, signal.price1, signal.price2, states);
      }
    } else if (signal.action === 'buy_spread' || signal.action === 'sell_spread') {
      await this.orderExecutor.openSpread(strategy, config, signal, states, errors);
    }
  }

  async processLucyStrategy(
    strategy: Strategy,
    config: EngineConfig,
    states: Map<number, StrategyState>,
    errors: string[]
  ): Promise<void> {
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
    const state = states.get(strategy.id);

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
        await this.orderExecutor.closeTrade(strategy, config, state, result.reason, states, ctx.currentPrice);
      }
      return;
    }

    if (state?.inPosition) {
      const opposite =
        (state.side === 'buy' && result.action === 'enter_short') ||
        (state.side === 'sell' && result.action === 'enter_long');
      if (result.action === 'exit' || opposite) {
        await this.orderExecutor.closeTrade(strategy, config, state, result.reason, states, ctx.currentPrice);
      } else if (config.stop_loss_pct || config.take_profit_pct) {
        await this.checkRiskLimits(strategy, config, state, ctx.currentPrice, states);
      }
    } else if (result.action === 'enter_long' || result.action === 'enter_short') {
      const side = result.action === 'enter_long' ? 'buy' : 'sell';
      await this.orderExecutor.openTrade(strategy, config, side, ctx.currentPrice, states, errors, true);
    }
  }

  async processIndicatorStrategy(
    strategy: Strategy,
    config: EngineConfig,
    states: Map<number, StrategyState>,
    errors: string[]
  ): Promise<void> {
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
    const state = states.get(strategy.id);

    await this.logSignal(strategy, signal, indicators);

    workerLogger.info(
      `#${strategy.id} ${strategy.name} | ${config.symbol} | action=${signal.action} | conf=${signal.confidence.toFixed(2)} | pos=${state?.inPosition ? 'OPEN' : 'NONE'} | ${signal.reason}`
    );

    if (state?.inPosition) {
      if (signal.action === 'exit') {
        await this.orderExecutor.closeTrade(strategy, config, state, signal.reason, states, ctx.currentPrice);
      } else if (config.stop_loss_pct || config.take_profit_pct) {
        await this.checkRiskLimits(strategy, config, state, ctx.currentPrice, states);
      }
    } else if (signal.action === 'enter_long' || signal.action === 'enter_short') {
      const side = signal.action === 'enter_long' ? 'buy' : 'sell';
      await this.orderExecutor.openTrade(strategy, config, side, ctx.currentPrice, states, errors);
    }
  }

  async checkRiskLimits(
    strategy: Strategy,
    config: EngineConfig,
    state: StrategyState,
    currentPrice: number,
    states: Map<number, StrategyState>
  ): Promise<void> {
    const pnl = signedPnlPct(state.side, state.entryPrice, currentPrice);
    const trigger = evaluateRiskLimits(pnl, config.stop_loss_pct, config.take_profit_pct);

    if (trigger === 'stop_loss') {
      tradeLogger.info('STOP_LOSS', { strategyId: strategy.id, pnl: `${pnl.toFixed(2)}%` });
      await this.orderExecutor.closeTrade(strategy, config, state, 'stop_loss', states, currentPrice);
    } else if (trigger === 'take_profit') {
      tradeLogger.info('TAKE_PROFIT', { strategyId: strategy.id, pnl: `${pnl.toFixed(2)}%` });
      await this.orderExecutor.closeTrade(strategy, config, state, 'take_profit', states, currentPrice);
    }
  }

  async checkSpreadRiskLimits(
    strategy: Strategy,
    config: EngineConfig,
    state: StrategyState,
    price1: number,
    price2: number,
    states: Map<number, StrategyState>
  ): Promise<void> {
    const pnl = spreadPnlPct(
      state.side,
      state.entryPrice,
      price1,
      state.quantity ?? 0,
      state.pairSide,
      state.pairEntryPrice,
      price2,
      state.pairQuantity ?? 0
    );
    const trigger = evaluateRiskLimits(pnl, config.stop_loss_pct, config.take_profit_pct);

    if (trigger === 'stop_loss') {
      tradeLogger.info('STOP_LOSS', { strategyId: strategy.id, pnl: `${pnl.toFixed(2)}%` });
      await this.orderExecutor.closeTrade(strategy, config, state, 'stop_loss', states, price1, price2);
    } else if (trigger === 'take_profit') {
      tradeLogger.info('TAKE_PROFIT', { strategyId: strategy.id, pnl: `${pnl.toFixed(2)}%` });
      await this.orderExecutor.closeTrade(strategy, config, state, 'take_profit', states, price1, price2);
    }
  }

  async logSignal(strategy: Strategy, signal: any, indicators: EvaluatedIndicators): Promise<void> {
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
      workerLogger.error(`[StrategyRunner] Error guardando señal: ${err.message}`);
    }
  }
}
