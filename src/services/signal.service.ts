import Signal from '../models/Signal';

export class SignalService {
  async getUserSignals(userId: number, limit = 50, source?: string) {
    const signals = await Signal.findAll({
      where: {
        userId,
        ...(source ? { source } : {}),
      },
      order: [['createdAt', 'DESC']],
      limit,
    });

    return signals.map((s) => ({
      id: s.id,
      strategyId: s.strategyId,
      userId: s.userId,
      symbol: s.symbol,
      action: s.action,
      confidence: s.confidence,
      reason: s.reason,
      indicators: s.indicators,
      price: Number(s.price),
      executed: s.executed,
      source: s.source,
      brokerAccountId: s.brokerAccountId,
      lucyRunId: s.lucyRunId,
      decision: s.decision,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}

export const signalService = new SignalService();
