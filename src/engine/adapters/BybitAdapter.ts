// ============================================================
// BybitAdapter - Adaptador para Bybit (Spot / Linear)
// ============================================================
import { createHmac } from 'crypto';
import { IBrokerAdapter } from '../IBrokerAdapter';
import { BrokerId, BrokerPosition, OrderResult, UnifiedOrder } from '../engine.types';
import { BrokerAccountType, BrokerEnvironment } from '../../types';

export interface BybitAdapterOptions {
  apiKey?: string;
  apiSecret?: string;
  environment?: BrokerEnvironment;
  accountType?: BrokerAccountType;
}

type BybitCategory = 'spot' | 'linear';

export class BybitAdapter implements IBrokerAdapter {
  readonly brokerId: BrokerId = 'bybit';
  readonly label = 'Bybit';

  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private category: BybitCategory;

  constructor(options: BybitAdapterOptions = {}) {
    this.apiKey = options.apiKey || process.env.BYBIT_API_KEY || '';
    this.apiSecret = options.apiSecret || process.env.BYBIT_API_SECRET || '';
    this.baseUrl =
      options.environment === 'testnet'
        ? 'https://api-testnet.bybit.com'
        : 'https://api.bybit.com';
    this.category = options.accountType === 'futures' ? 'linear' : 'spot';
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.getPrice('BTCUSDT');
      if (!this.apiKey || !this.apiSecret) return true;
      const data = await this.privateGet('/v5/account/wallet-balance', {
        accountType: 'UNIFIED',
      });
      return data.retCode === 0;
    } catch {
      return false;
    }
  }

  async getPrice(symbol: string): Promise<number> {
    const normalized = symbol.toUpperCase();
    const res = await fetch(
      `${this.baseUrl}/v5/market/tickers?category=${this.category}&symbol=${normalized}`
    );
    if (!res.ok) {
      throw new Error(`Par no disponible en Bybit: ${normalized}`);
    }
    const data = (await res.json()) as {
      retCode: number;
      result?: { list?: Array<{ lastPrice?: string }> };
    };
    const price = parseFloat(data.result?.list?.[0]?.lastPrice || '0');
    if (!price) {
      throw new Error(`Precio no disponible para ${normalized}`);
    }
    return price;
  }

  async executeOrder(order: UnifiedOrder): Promise<OrderResult> {
    const symbol = order.symbol.toUpperCase();
    const qty = String(order.quantity ?? order.lot ?? 0);
    const side = order.side === 'buy' ? 'Buy' : 'Sell';

    if (!this.apiKey || !this.apiSecret) {
      if (process.env.PAPER_TRADING === 'true') {
        const price = await this.getPrice(symbol).catch(() => 0);
        return {
          success: true,
          broker: this.brokerId,
          ticket: `SIMULATED-${Date.now()}`,
          symbol,
          side: order.side,
          quantity: Number(qty),
          executedPrice: price,
          raw: {
            mode: 'paper_trading',
            message: 'PAPER_TRADING=true. Conecta una cuenta Bybit para operar en real.',
          },
        };
      }
      return {
        success: false,
        broker: this.brokerId,
        symbol,
        side: order.side,
        error: 'Sin credenciales Bybit. Conecta una cuenta o activa PAPER_TRADING=true.',
      };
    }

    try {
      const body: Record<string, string> = {
        category: this.category,
        symbol,
        side,
        orderType: 'Market',
        qty,
      };

      if (this.category === 'linear') {
        body.positionIdx = '0';
      }

      const data = await this.privatePost('/v5/order/create', body);
      if (data.retCode !== 0) {
        return {
          success: false,
          broker: this.brokerId,
          symbol,
          side: order.side,
          error: data.retMsg || 'Bybit rechazó la orden',
          raw: data,
        };
      }

      const result = data.result || {};
      return {
        success: true,
        broker: this.brokerId,
        ticket: result.orderId,
        symbol,
        side: order.side,
        quantity: Number(qty),
        executedPrice: parseFloat(result.avgPrice || result.price || '0') || undefined,
        raw: data,
      };
    } catch (err: any) {
      return {
        success: false,
        broker: this.brokerId,
        symbol,
        side: order.side,
        error: err.message || 'Error ejecutando orden en Bybit',
      };
    }
  }

  async getPositions(): Promise<BrokerPosition[]> {
    if (!this.apiKey || !this.apiSecret) return [];

    try {
      if (this.category === 'linear') {
        const data = await this.privateGet('/v5/position/list', {
          category: 'linear',
          settleCoin: 'USDT',
        });
        if (data.retCode !== 0 || !data.result?.list) return [];

        return data.result.list
          .filter((p: any) => parseFloat(p.size || '0') > 0)
          .map((p: any) => ({
            broker: this.brokerId,
            ticket: p.positionIdx ?? p.symbol,
            symbol: p.symbol,
            side: p.side === 'Buy' ? 'buy' : 'sell',
            quantity: parseFloat(p.size),
            openPrice: parseFloat(p.avgPrice || p.entryPrice || '0'),
            currentPrice: parseFloat(p.markPrice || '0'),
            profit: parseFloat(p.unrealisedPnl || '0'),
            sl: parseFloat(p.stopLoss || '0') || undefined,
            tp: parseFloat(p.takeProfit || '0') || undefined,
            comment: `Bybit ${p.symbol}`,
          }));
      }

      const data = await this.privateGet('/v5/order/realtime', {
        category: 'spot',
        openOnly: '0',
      });
      if (data.retCode !== 0 || !data.result?.list) return [];

      return data.result.list.map((o: any) => ({
        broker: this.brokerId,
        ticket: o.orderId,
        symbol: o.symbol,
        side: o.side === 'Buy' ? 'buy' : 'sell',
        quantity: parseFloat(o.qty || '0'),
        openPrice: parseFloat(o.price || o.avgPrice || '0'),
        currentPrice: parseFloat(o.price || o.avgPrice || '0'),
        profit: 0,
        openTime: o.createdTime ? new Date(Number(o.createdTime)).toISOString() : undefined,
        comment: `Bybit Order #${o.orderId}`,
      }));
    } catch {
      return [];
    }
  }

  async closePosition(ticket: string | number): Promise<OrderResult> {
    if (String(ticket).startsWith('SIMULATED-')) {
      return {
        success: true,
        broker: this.brokerId,
        ticket,
        symbol: '',
        side: 'sell',
        raw: { mode: 'paper_trading' },
      };
    }

    if (!this.apiKey || !this.apiSecret) {
      return {
        success: false,
        broker: this.brokerId,
        symbol: '',
        side: 'sell',
        error: 'Credenciales Bybit no configuradas',
      };
    }

    if (this.category !== 'linear') {
      return {
        success: false,
        broker: this.brokerId,
        symbol: '',
        side: 'sell',
        ticket,
        error: 'Cierre automático solo soportado en Bybit futures (linear)',
      };
    }

    try {
      const positions = await this.getPositions();
      const position = positions.find((p) => String(p.ticket) === String(ticket));
      if (!position) {
        return {
          success: false,
          broker: this.brokerId,
          symbol: '',
          side: 'sell',
          ticket,
          error: 'Posición no encontrada en Bybit',
        };
      }

      const closeSide = position.side === 'buy' ? 'Sell' : 'Buy';
      const data = await this.privatePost('/v5/order/create', {
        category: 'linear',
        symbol: position.symbol,
        side: closeSide,
        orderType: 'Market',
        qty: String(position.quantity),
        reduceOnly: 'true',
        positionIdx: '0',
      });

      if (data.retCode !== 0) {
        return {
          success: false,
          broker: this.brokerId,
          symbol: position.symbol,
          side: position.side === 'buy' ? 'sell' : 'buy',
          ticket,
          error: data.retMsg || 'Error al cerrar posición en Bybit',
          raw: data,
        };
      }

      return {
        success: true,
        broker: this.brokerId,
        symbol: position.symbol,
        side: position.side === 'buy' ? 'sell' : 'buy',
        ticket: data.result?.orderId || ticket,
        raw: data,
      };
    } catch (err: any) {
      return {
        success: false,
        broker: this.brokerId,
        symbol: '',
        side: 'sell',
        ticket,
        error: err.message || 'Error al cerrar posición en Bybit',
      };
    }
  }

  private async privateGet(path: string, params: Record<string, string>) {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const queryString = new URLSearchParams(params).toString();
    const signature = this.sign(timestamp, recvWindow, queryString);
    const url = queryString ? `${this.baseUrl}${path}?${queryString}` : `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      headers: {
        'X-BAPI-API-KEY': this.apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      },
    });

    return (await res.json()) as any;
  }

  private async privatePost(path: string, body: Record<string, string>) {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const payload = JSON.stringify(body);
    const signature = this.sign(timestamp, recvWindow, payload);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAPI-API-KEY': this.apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      },
      body: payload,
    });

    return (await res.json()) as any;
  }

  private sign(timestamp: string, recvWindow: string, payload: string): string {
    return createHmac('sha256', this.apiSecret)
      .update(`${timestamp}${this.apiKey}${recvWindow}${payload}`)
      .digest('hex');
  }
}
