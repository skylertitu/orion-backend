import { randomUUID } from 'crypto';
import { WsKline } from '../services/binanceWs';
import { lucyService } from '../integrations/lucy/lucy.service';
import { LucyAnalysisResult, LucySignal } from '../integrations/lucy/lucy.types';
import Signal from '../models/Signal';
import Strategy from '../models/Strategy';
import { strategyEngine, EvaluatedIndicators, StrategyConfig } from '../engine/StrategyEngine';
import { LUCY_INTEGRATION } from '../integrations/lucy/lucy.pending';
import { workerLogger } from '../utils/logger';

export type LucyStrategyAction = 'enter_long' | 'enter_short' | 'exit' | 'hold';

export interface LucyPipelineResult {
  runId: string;
  analysis: LucyAnalysisResult | null;
  action: LucyStrategyAction;
  confidence: number;
  reason: string;
  price: number;
  indicators: EvaluatedIndicators;
  lucySignal?: LucySignal;
}

export function klinesToLucyData(klines: WsKline[]): number[][] {
  return klines.map((k) => [
    k.openTime,
    k.open,
    k.high,
    k.low,
    k.close,
    k.volume,
  ]);
}

export function mapLucyAction(action: LucySignal['action']): LucyStrategyAction {
  if (action === 'buy') return 'enter_long';
  if (action === 'sell') return 'enter_short';
  if (action === 'exit' || action === 'close') return 'exit';
  return 'hold';
}

export class LucyOrchestrator {
  async runPipeline(
    strategy: Strategy,
    klines: WsKline[],
    indicators: EvaluatedIndicators
  ): Promise<LucyPipelineResult> {
    const config = strategy.config as StrategyConfig;
    const runId = randomUUID();
    const price = klines[klines.length - 1]?.close ?? 0;

    const fallback: LucyPipelineResult = {
      runId,
      analysis: null,
      action: 'hold',
      confidence: 0,
      reason: LUCY_INTEGRATION.pending ? LUCY_INTEGRATION.reason : 'Lucy no disponible',
      price,
      indicators,
    };

    if (LUCY_INTEGRATION.pending) {
      return fallback;
    }

    const alive = await lucyService.healthCheck();
    if (!alive) {
      await this.persistSignal(strategy, fallback, 'lucy_unavailable');
      return fallback;
    }

    try {
      const analysis = await lucyService.analyzeChart({
        symbol: config.symbol,
        interval: config.interval || '1m',
        data: klinesToLucyData(klines),
        indicators: indicators as Record<string, unknown>,
      });

      const best = this.pickBestSignal(analysis);
      const action = best ? mapLucyAction(best.action) : 'hold';
      const result: LucyPipelineResult = {
        runId,
        analysis,
        action,
        confidence: best?.confidence ?? 0,
        reason: best
          ? `Lucy: ${best.action} (${(best.confidence * 100).toFixed(0)}%)`
          : `Lucy: ${analysis.trend} — sin señal clara`,
        price,
        indicators,
        lucySignal: best,
      };

      await this.persistSignal(strategy, result, analysis.trend);
      return result;
    } catch (err: any) {
      workerLogger.error(`[Lucy] Error en estrategia ${strategy.id}: ${err.message}`);
      fallback.reason = err.message || 'Error al consultar Lucy';
      await this.persistSignal(strategy, fallback, 'error');
      return fallback;
    }
  }

  private pickBestSignal(analysis: LucyAnalysisResult): LucySignal | undefined {
    const actionable = analysis.signals?.filter((s) => s.action !== 'hold') ?? [];
    if (!actionable.length) return undefined;
    return actionable.sort((a, b) => b.confidence - a.confidence)[0];
  }

  private async persistSignal(
    strategy: Strategy,
    result: LucyPipelineResult,
    trendOrStatus: string
  ): Promise<void> {
    if (result.action === 'hold' && !result.analysis) return;

    try {
      await Signal.create({
        strategyId: strategy.id,
        userId: strategy.userId,
        symbol: (strategy.config as StrategyConfig).symbol,
        action: result.action,
        confidence: result.confidence,
        reason: result.reason,
        indicators: {
          ...result.indicators,
          lucyTrend: trendOrStatus,
          lucyPatterns: result.analysis?.patterns ?? [],
          lucySupport: result.analysis?.support,
          lucyResistance: result.analysis?.resistance,
        },
        price: result.price,
        executed: false,
        source: 'lucy',
        brokerAccountId: (strategy.config as StrategyConfig).brokerAccountId ?? null,
        lucyRunId: result.runId,
        decision: result.analysis
          ? {
              trend: result.analysis.trend,
              patterns: result.analysis.patterns,
              support: result.analysis.support,
              resistance: result.analysis.resistance,
              signal: result.lucySignal,
            }
          : { error: result.reason },
      });
    } catch (err: any) {
      workerLogger.error(`[Lucy] Error guardando señal: ${err.message}`);
    }
  }

  shouldAutoExecute(config: StrategyConfig, result: LucyPipelineResult): boolean {
    if (LUCY_INTEGRATION.pending) return false;
    if (!config.autoExecute) return false;
    const min = config.minConfidence ?? 0.6;
    if (result.action === 'hold') return false;
    if (result.action === 'exit') return true;
    return result.confidence >= min;
  }
}

export const lucyOrchestrator = new LucyOrchestrator();
