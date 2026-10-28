import { Op } from 'sequelize';
import { BrokerAccount, Trade } from '../models';
import { tradingEngine } from '../engine/TradingEngine';
import { BrokerId } from '../engine/engine.types';
import { isPaperTradingForced } from '../engine/executionMode';
import { signedPnlRatio, signedPnlPct } from '../engine/pnl';

export interface PaperOpenPosition {
  tradeId: number;
  ticket: string | null;
  broker: string;
  brokerAccountId: number | null;
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  openedAt: Date;
}

export interface PaperSummary {
  userId: number;
  brokerAccountId?: number;
  initialBalance: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  equityUsd: number;
  openPositionsCount: number;
  closedTradesCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  isPaperForced: boolean;
  openPositions: PaperOpenPosition[];
}

export class PaperTradingService {
  async getPaperSummary(userId: number, brokerAccountId?: number): Promise<PaperSummary> {
    let initialBalance = 10000;
    if (brokerAccountId) {
      const account = await BrokerAccount.findOne({ where: { id: brokerAccountId, userId } });
      if (account?.meta?.paperInitialBalance) {
        initialBalance = Number(account.meta.paperInitialBalance) || 10000;
      }
    }

    const demoWhereClause: any = {
      userId,
      [Op.or]: [
        { ticket: { [Op.like]: 'SIMULATED-%' } },
        { '$raw.mode$': 'demo' },
      ],
      ...(brokerAccountId ? { brokerAccountId } : {}),
    };

    const trades = await Trade.findAll({
      where: demoWhereClause,
      order: [['openedAt', 'DESC']],
    });

    let realizedPnlUsd = 0;
    let winCount = 0;
    let lossCount = 0;
    let closedTradesCount = 0;

    const openPositions: PaperOpenPosition[] = [];
    let unrealizedPnlUsd = 0;

    for (const trade of trades) {
      const qty = Number(trade.quantity) || Number(trade.lot) || 0;
      const entryPrice = Number(trade.entryPrice) || 0;

      if (trade.status === 'closed') {
        closedTradesCount++;
        const pnl = Number(trade.raw?.pnlUsd);
        const effectivePnlUsd =
          Number.isFinite(pnl)
            ? pnl
            : (Number(trade.pnlPct) || 0) * entryPrice * qty;

        realizedPnlUsd += effectivePnlUsd;
        if (effectivePnlUsd > 0) {
          winCount++;
        } else if (effectivePnlUsd < 0) {
          lossCount++;
        }
      } else if (trade.status === 'open') {
        let currentPrice = entryPrice;
        try {
          currentPrice = await tradingEngine.getPrice(
            trade.broker as BrokerId,
            trade.symbol,
            userId,
            trade.brokerAccountId || undefined
          );
        } catch {
          currentPrice = entryPrice;
        }

        const delta = trade.side === 'sell' ? entryPrice - currentPrice : currentPrice - entryPrice;
        const posPnlUsd = delta * qty;
        const posPnlPct = signedPnlPct(trade.side as 'buy' | 'sell', entryPrice, currentPrice);

        unrealizedPnlUsd += posPnlUsd;
        openPositions.push({
          tradeId: trade.id,
          ticket: trade.ticket,
          broker: trade.broker,
          brokerAccountId: trade.brokerAccountId,
          symbol: trade.symbol,
          side: trade.side,
          quantity: qty,
          entryPrice,
          currentPrice,
          unrealizedPnlUsd: Number(posPnlUsd.toFixed(2)),
          unrealizedPnlPct: Number(posPnlPct.toFixed(2)),
          openedAt: trade.openedAt,
        });
      }
    }

    const totalClosed = winCount + lossCount;
    const winRatePct = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;
    const equityUsd = initialBalance + realizedPnlUsd + unrealizedPnlUsd;

    return {
      userId,
      brokerAccountId,
      initialBalance: Number(initialBalance.toFixed(2)),
      realizedPnlUsd: Number(realizedPnlUsd.toFixed(2)),
      unrealizedPnlUsd: Number(unrealizedPnlUsd.toFixed(2)),
      equityUsd: Number(equityUsd.toFixed(2)),
      openPositionsCount: openPositions.length,
      closedTradesCount,
      winCount,
      lossCount,
      winRatePct: Number(winRatePct.toFixed(2)),
      isPaperForced: isPaperTradingForced(),
      openPositions,
    };
  }

  async resetPaperTrading(
    userId: number,
    brokerAccountId?: number,
    newBalance = 10000
  ): Promise<PaperSummary> {
    const demoWhereClause: any = {
      userId,
      [Op.or]: [
        { ticket: { [Op.like]: 'SIMULATED-%' } },
        { '$raw.mode$': 'demo' },
      ],
      ...(brokerAccountId ? { brokerAccountId } : {}),
    };

    // Close any open simulated trades and mark demo trades as closed
    await Trade.update(
      {
        status: 'closed',
        closeReason: 'paper_reset',
        closedAt: new Date(),
      },
      { where: demoWhereClause }
    );

    if (brokerAccountId) {
      const account = await BrokerAccount.findOne({ where: { id: brokerAccountId, userId } });
      if (account) {
        await account.update({
          meta: {
            ...(account.meta || {}),
            paperInitialBalance: newBalance,
            paperResetAt: new Date().toISOString(),
          },
        });
      }
    }

    return this.getPaperSummary(userId, brokerAccountId);
  }
}

export const paperTradingService = new PaperTradingService();
