// ============================================================
// MT5Adapter - Adaptador por cuenta (magic + comentario Orion)
// El terminal es compartido; el aislamiento es por magic de broker_account.
// ============================================================
import { IBrokerAdapter } from '../IBrokerAdapter';
import { BrokerId, BrokerPosition, OrderResult, UnifiedOrder } from '../engine.types';
import { metatraderService } from '../../integrations/metatrader/mt.service';
import { commentForAccount, magicForAccount, parseOwnerFromComment } from '../mtIdentity';

export interface MT5AdapterOptions {
  userId?: number;
  accountId?: number;
}

export class MT5Adapter implements IBrokerAdapter {
  readonly brokerId: BrokerId = 'mt5';
  readonly label = 'MetaTrader 4 / 5';

  private readonly userId?: number;
  private readonly accountId?: number;
  private readonly magic?: number;
  private readonly commentTag: string;

  constructor(options: MT5AdapterOptions = {}) {
    this.userId = options.userId;
    this.accountId = options.accountId;
    this.magic = options.accountId ? magicForAccount(options.accountId) : undefined;
    this.commentTag =
      options.userId && options.accountId
        ? commentForAccount(options.userId, options.accountId)
        : 'Orion';
  }

  async isConnected(): Promise<boolean> {
    if (process.env.MT_ENABLED !== 'true') return false;
    return metatraderService.ping();
  }

  async getPrice(symbol: string): Promise<number> {
    try {
      const result = await metatraderService.getMtPrice(symbol);
      if (result.status === 'OK') {
        const bid = result.bid ?? 0;
        const ask = result.ask ?? 0;
        const mid = (bid + ask) / 2;
        return mid > 0 ? mid : bid || ask || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async executeOrder(order: UnifiedOrder): Promise<OrderResult> {
    if (!this.accountId || !this.userId || !this.magic) {
      return {
        success: false,
        broker: this.brokerId,
        symbol: order.symbol,
        side: order.side,
        error: 'Conecta una cuenta MetaTrader antes de operar.',
      };
    }

    const symbol = order.symbol.toUpperCase();
    const lots = order.lot ?? order.quantity ?? 0.01;
    const side = order.side.toLowerCase() as 'buy' | 'sell';
    const comment = order.comment
      ? `${this.commentTag} ${order.comment}`.slice(0, 31)
      : this.commentTag;

    try {
      const result = side === 'buy'
        ? await metatraderService.buyMarket(symbol, lots, order.sl ?? 0, order.tp ?? 0, comment, this.magic)
        : await metatraderService.sellMarket(symbol, lots, order.sl ?? 0, order.tp ?? 0, comment, this.magic);

      if (result.status === 'ERROR') {
        return { success: false, broker: this.brokerId, symbol, side, lot: lots, error: result.error };
      }
      return {
        success: true,
        broker: this.brokerId,
        ticket: result.ticket,
        symbol: result.symbol ?? symbol,
        side,
        lot: result.lots ?? lots,
        executedPrice: result.openPrice,
        brokerAccountId: this.accountId,
        raw: result,
      };
    } catch (err: any) {
      return { success: false, broker: this.brokerId, symbol, side, error: err.message };
    }
  }

  async getPositions(): Promise<BrokerPosition[]> {
    try {
      const result = await metatraderService.getPositions(this.magic);
      if (result.status !== 'OK' || !result.positions) return [];
      return result.positions
        .filter((p) => this.ownsPosition(p.magic, p.comment))
        .map((p) => ({
          broker: this.brokerId,
          ticket: p.ticket,
          symbol: p.symbol,
          side: p.type.toLowerCase() as 'buy' | 'sell',
          lot: p.lots,
          openPrice: p.openPrice,
          currentPrice: p.currentPrice,
          profit: p.profit,
          sl: p.sl,
          tp: p.tp,
          openTime: p.openTime,
          comment: p.comment,
          brokerAccountId: this.accountId,
        }));
    } catch {
      return [];
    }
  }

  async closePosition(ticket: string | number): Promise<OrderResult> {
    if (!this.accountId || !this.magic) {
      return {
        success: false,
        broker: this.brokerId,
        symbol: '',
        side: 'sell',
        ticket,
        error: 'Conecta una cuenta MetaTrader antes de cerrar posiciones.',
      };
    }

    const owned = await this.getPositions();
    const position = owned.find((p) => String(p.ticket) === String(ticket));
    if (!position) {
      return {
        success: false,
        broker: this.brokerId,
        symbol: '',
        side: 'sell',
        ticket,
        error: 'Esa posición no pertenece a tu cuenta MetaTrader',
      };
    }

    try {
      const result = await metatraderService.closePosition(Number(ticket), this.magic);
      if (result.status === 'ERROR') {
        return { success: false, broker: this.brokerId, symbol: position.symbol, side: 'sell', ticket, error: result.error };
      }
      return {
        success: true,
        broker: this.brokerId,
        symbol: position.symbol,
        side: 'sell',
        ticket,
        brokerAccountId: this.accountId,
        raw: result,
      };
    } catch (err: any) {
      return { success: false, broker: this.brokerId, symbol: position.symbol, side: 'sell', ticket, error: err.message };
    }
  }

  async closeOwnedPositions(): Promise<OrderResult> {
    if (!this.magic) {
      return {
        success: false,
        broker: this.brokerId,
        symbol: '',
        side: 'sell',
        error: 'Conecta una cuenta MetaTrader antes de cerrar posiciones.',
      };
    }
    try {
      const result = await metatraderService.closeAll(this.magic);
      if (result.status === 'ERROR') {
        return { success: false, broker: this.brokerId, symbol: '', side: 'sell', error: result.error };
      }
      return { success: true, broker: this.brokerId, symbol: '', side: 'sell', brokerAccountId: this.accountId, raw: result };
    } catch (err: any) {
      return { success: false, broker: this.brokerId, symbol: '', side: 'sell', error: err.message };
    }
  }

  private ownsPosition(magic?: number, comment?: string): boolean {
    if (this.magic && magic && magic === this.magic) return true;
    if (this.accountId) {
      const owner = parseOwnerFromComment(comment);
      if (owner.accountId === this.accountId && owner.userId === this.userId) return true;
    }
    if (!this.accountId) return true;
    return false;
  }
}
