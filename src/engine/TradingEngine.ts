// ============================================================
// TradingEngine - Orquestador Central Multi-Broker
// ============================================================
import { accountResolver } from './AccountResolver';
import { IBrokerAdapter } from './IBrokerAdapter';
import { BrokerId, BrokerPosition, BrokerStatus, OrderResult, UnifiedOrder } from './engine.types';
import { BrokerAccount } from '../models';
import { engineLogger } from '../utils/logger';

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
  }> {
    if (order.userId) {
      const { resolved, adapter } = await accountResolver.resolveAdapter({
        userId: order.userId,
        brokerAccountId: order.brokerAccountId,
        brokerId: order.broker,
        requireActive: true,
      });
      return { adapter, brokerAccountId: resolved.accountId };
    }

    return { adapter: this.getAdapter(order.broker) };
  }

  async execute(order: UnifiedOrder): Promise<OrderResult> {
    try {
      const { adapter, brokerAccountId } = await this.resolveAdapter(order);
      const result = await adapter.executeOrder(order);
      if (brokerAccountId) {
        result.brokerAccountId = brokerAccountId;
      }
      if (!result.success) {
        engineLogger.error(
          `Envío fallido ${order.side} ${order.symbol} → ${order.broker}: ${result.error}`
        );
      } else {
        engineLogger.info(
          `Envío ${order.side} ${order.symbol} → ${order.broker} ticket=${result.ticket ?? '-'}`
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
        message = connected
          ? 'Conexión activa y respondiendo.'
          : 'El broker no respondió a la verificación.';
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
        error: connected ? undefined : error || message,
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
        const positions = await adapter.getPositions().catch(() => []);
        allPositions.push(
          ...positions.map((p) => ({ ...p, brokerAccountId: resolved.accountId }))
        );
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
