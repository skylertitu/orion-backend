// ============================================================
// TradingEngine - Orquestador Central Multi-Broker
// ============================================================
import { accountResolver } from './AccountResolver';
import { IBrokerAdapter } from './IBrokerAdapter';
import { BrokerId, BrokerPosition, BrokerStatus, OrderResult, OrderSide, UnifiedOrder } from './engine.types';
import { BrokerAccount, Trade } from '../models';
import { engineLogger } from '../utils/logger';
import { ExecutionMode } from './executionMode';

class TradingEngine {
  private adapters = new Map<BrokerId, IBrokerAdapter>();

  register(adapter: IBrokerAdapter): void {
    this.adapters.set(adapter.brokerId, adapter);
    engineLogger.info(`Adaptador registrado: ${adapter.label} (${adapter.brokerId})`);
  }

  getAdapter(brokerId: BrokerId): IBrokerAdapter {
    const adapter = this.adapters.get(brokerId);
    if (!adapter) {
      throw new Error(
        `Broker no registrado: "${brokerId}". Brokers disponibles: ${[...this.adapters.keys()].join(', ')}`
      );
    }
    return adapter;
  }

  private async resolveAdapter(order: UnifiedOrder): Promise<{
    adapter: IBrokerAdapter;
    brokerAccountId?: number;
    executionMode: ExecutionMode;
    userId?: number;
  }> {
    if (order.userId) {
      const { resolved, adapter } = await accountResolver.resolveAdapter({
        userId: order.userId,
        brokerAccountId: order.brokerAccountId,
        brokerId: order.broker,
        requireActive: true,
      });
      return {
        adapter,
        brokerAccountId: resolved.accountId,
        executionMode: resolved.executionMode,
        userId: resolved.userId,
      };
    }

    return { adapter: this.getAdapter(order.broker), executionMode: 'live' };
  }

  private async paperFill(order: UnifiedOrder, adapter: IBrokerAdapter, brokerAccountId?: number): Promise<OrderResult> {
    const symbol = order.symbol.toUpperCase();
    const price = await adapter.getPrice(symbol).catch(() => 0);
    return {
      success: true,
      broker: order.broker,
      ticket: `SIMULATED-${Date.now()}`,
      symbol,
      side: order.side,
      quantity: order.quantity,
      lot: order.lot,
      executedPrice: price,
      brokerAccountId,
      raw: {
        mode: 'demo',
        message: 'Orden DEMO. No se envió al exchange. Pasa la cuenta a LIVE cuando quieras operar real.',
      },
    };
  }

  private async listPaperPositions(
    userId: number,
    adapter: IBrokerAdapter,
    brokerId: BrokerId,
    brokerAccountId: number
  ): Promise<BrokerPosition[]> {
    const trades = await Trade.findAll({
      where: { userId, brokerAccountId, status: 'open' },
      order: [['openedAt', 'DESC']],
    });
    const positions: BrokerPosition[] = [];
    for (const trade of trades) {
      const entry = Number(trade.entryPrice);
      const qty = Number(trade.quantity) || Number(trade.lot) || 0;
      const current = await adapter.getPrice(trade.symbol).catch(() => entry);
      const delta = trade.side === 'sell' ? entry - current : current - entry;
      positions.push({
        broker: brokerId,
        ticket: trade.ticket || trade.id,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity != null ? Number(trade.quantity) : undefined,
        lot: trade.lot != null ? Number(trade.lot) : undefined,
        openPrice: entry,
        currentPrice: current,
        profit: delta * qty,
        comment: 'DEMO',
        brokerAccountId,
      });
    }
    return positions;
  }

  private async closePaperTrade(
    userId: number,
    ticket: string | number,
    adapter: IBrokerAdapter,
    brokerId: BrokerId,
    brokerAccountId?: number
  ): Promise<OrderResult> {
    const trade = await Trade.findOne({
      where: {
        userId,
        ticket: String(ticket),
        status: 'open',
        ...(brokerAccountId ? { brokerAccountId } : {}),
      },
    });
    const symbol = trade?.symbol || '';
    const side = (trade?.side || 'sell') as OrderSide;
    const exitPrice = symbol ? await adapter.getPrice(symbol).catch(() => Number(trade?.entryPrice || 0)) : 0;
    if (trade) {
      const entry = Number(trade.entryPrice) || 0;
      const pnlPct = entry ? (side === 'sell' ? (entry - exitPrice) / entry : (exitPrice - entry) / entry) : 0;
      await trade.update({
        status: 'closed',
        exitPrice,
        closedAt: new Date(),
        closeReason: 'demo_close',
        pnlPct,
      });
    }
    return {
      success: true,
      broker: brokerId,
      ticket,
      symbol,
      side,
      executedPrice: exitPrice,
      brokerAccountId,
      raw: { mode: 'demo' },
    };
  }

  async execute(order: UnifiedOrder): Promise<OrderResult> {
    try {
      const { adapter, brokerAccountId, executionMode } = await this.resolveAdapter(order);
      const result =
        executionMode === 'demo'
          ? await this.paperFill(order, adapter, brokerAccountId)
          : await adapter.executeOrder(order);
      if (brokerAccountId) {
        result.brokerAccountId = brokerAccountId;
      }
      if (!result.success) {
        engineLogger.error(
          `Envío fallido ${order.side} ${order.symbol} → ${order.broker}: ${result.error}`
        );
      } else {
        engineLogger.info(
          `Envío ${executionMode === 'demo' ? 'DEMO ' : ''}${order.side} ${order.symbol} → ${order.broker} ticket=${result.ticket ?? '-'}`
        );
      }
      return result;
    } catch (err: any) {
      engineLogger.error(
        `Envío fallido ${order.side} ${order.symbol} → ${order.broker}: ${err?.message || err}`
      );
      return {
        success: false,
        broker: order.broker,
        symbol: order.symbol,
        side: order.side,
        error: err?.message || 'No se pudo resolver la cuenta del broker',
      };
    }
  }

  async getBrokerStatuses(): Promise<BrokerStatus[]> {
    const statuses: BrokerStatus[] = [];
    for (const [id, adapter] of this.adapters) {
      if (id === 'mt5' && process.env.MT_ENABLED !== 'true') {
        statuses.push({
          id,
          label: adapter.label,
          connected: false,
          enabled: false,
          message: 'MetaTrader está deshabilitado en el servidor.',
          error: 'MT_ENABLED=false en backend/.env',
        });
        continue;
      }

      let connected = false;
      let message = '';
      let error: string | undefined;

      try {
        connected = await adapter.isConnected();
        if (id === 'mt5') {
          message = connected
            ? 'OrionBridge respondió PONG.'
            : 'Adjunta OrionBridge en un gráfico de MT4/MT5. El puente está listo, el EA no contestó el PING.';
        } else if (id === 'bybit') {
          message = connected
            ? 'API pública de Bybit responde.'
            : 'Bybit no está disponible desde este servidor.';
        } else {
          message = connected ? 'Conexión activa y respondiendo.' : 'API pública no respondió.';
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Error al verificar conexión';
        error = errMsg;
        message = errMsg;
      }

      statuses.push({
        id,
        label: adapter.label,
        connected,
        enabled: true,
        message,
        error: connected ? undefined : error,
      });
    }
    return statuses;
  }

  async getAllPositions(userId?: number): Promise<BrokerPosition[]> {
    if (userId) {
      return this.getUserPositions(userId);
    }

    const allPositions: BrokerPosition[] = [];
    for (const adapter of this.adapters.values()) {
      const positions = await adapter.getPositions().catch(() => []);
      allPositions.push(...positions);
    }
    return allPositions;
  }

  async getUserPositions(
    userId: number,
    brokerId?: BrokerId,
    brokerAccountId?: number
  ): Promise<BrokerPosition[]> {
    if (brokerAccountId || brokerId) {
      try {
        const { resolved, adapter } = await accountResolver.resolveAdapter({
          userId,
          brokerAccountId,
          brokerId,
        });
        if (resolved.executionMode === 'demo') {
          return this.listPaperPositions(userId, adapter, resolved.brokerId, resolved.accountId);
        }
        const positions = await adapter.getPositions().catch(() => []);
        return positions.map((p) => ({ ...p, brokerAccountId: resolved.accountId }));
      } catch {
        return [];
      }
    }

    const accounts = await BrokerAccount.findAll({
      where: { userId },
      order: [
        ['isPrimary', 'DESC'],
        ['updatedAt', 'DESC'],
      ],
    });

    const allPositions: BrokerPosition[] = [];
    for (const account of accounts) {
      try {
        const { resolved, adapter } = await accountResolver.resolveAdapter({
          userId,
          brokerAccountId: account.id,
        });
        const positions =
          resolved.executionMode === 'demo'
            ? await this.listPaperPositions(userId, adapter, resolved.brokerId, resolved.accountId)
            : (await adapter.getPositions().catch(() => [])).map((p) => ({
                ...p,
                brokerAccountId: resolved.accountId,
              }));
        allPositions.push(...positions);
      } catch {
        /* omitir cuentas sin adaptador */
      }
    }

    return allPositions;
  }

  async getPositions(
    brokerId: BrokerId,
    userId?: number,
    brokerAccountId?: number
  ): Promise<BrokerPosition[]> {
    if (userId) {
      return this.getUserPositions(userId, brokerId, brokerAccountId);
    }
    return this.getAdapter(brokerId).getPositions();
  }

  async closePosition(
    brokerId: BrokerId,
    ticket: string | number,
    userId?: number,
    brokerAccountId?: number
  ): Promise<OrderResult> {
    if (userId) {
      try {
        const { resolved, adapter } = await accountResolver.resolveAdapter({
          userId,
          brokerAccountId,
          brokerId,
          requireActive: true,
        });
        if (resolved.executionMode === 'demo' || String(ticket).startsWith('SIMULATED-')) {
          return this.closePaperTrade(userId, ticket, adapter, brokerId, resolved.accountId);
        }
        const result = await adapter.closePosition(ticket);
        result.brokerAccountId = resolved.accountId;
        return result;
      } catch (err: any) {
        return {
          success: false,
          broker: brokerId,
          ticket,
          symbol: '',
          side: 'sell',
          error: err?.message || 'No se pudo resolver la cuenta para cerrar',
        };
      }
    }

    return this.getAdapter(brokerId).closePosition(ticket);
  }

  async getPrice(
    brokerId: BrokerId,
    symbol: string,
    userId?: number,
    brokerAccountId?: number
  ): Promise<number> {
    if (userId) {
      const { adapter } = await accountResolver.resolveAdapter({
        userId,
        brokerAccountId,
        brokerId,
      });
      return adapter.getPrice(symbol);
    }
    return this.getAdapter(brokerId).getPrice(symbol);
  }

  getRegisteredBrokers(): BrokerId[] {
    return [...this.adapters.keys()];
  }
}

export const tradingEngine = new TradingEngine();
