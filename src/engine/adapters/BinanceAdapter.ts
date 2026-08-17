// ============================================================
// BinanceAdapter - Adaptador para Binance Spot
// ============================================================
import { IBrokerAdapter } from '../IBrokerAdapter';
import { BrokerId, BrokerPosition, OrderResult, UnifiedOrder } from '../engine.types';
import { binanceService } from '../../services/binance.service';
import { BrokerEnvironment } from '../../types';

export interface BinanceAdapterOptions {
  apiKey?: string;
  apiSecret?: string;
  environment?: BrokerEnvironment;
}

export class BinanceAdapter implements IBrokerAdapter {
  readonly brokerId: BrokerId = 'binance';
  readonly label = 'Binance Spot';

  private apiKey: string;
  private apiSecret: string;
  private readonly baseUrl: string;

  constructor(apiKeyOrOptions: string | BinanceAdapterOptions = '', apiSecret = '') {
    if (typeof apiKeyOrOptions === 'object') {
      this.apiKey = apiKeyOrOptions.apiKey || process.env.BINANCE_API_KEY || '';
      this.apiSecret = apiKeyOrOptions.apiSecret || process.env.BINANCE_API_SECRET || '';
      this.baseUrl =
        apiKeyOrOptions.environment === 'testnet'
          ? 'https://testnet.binance.vision'
          : 'https://api.binance.com';
    } else {
      this.apiKey = apiKeyOrOptions || process.env.BINANCE_API_KEY || '';
      this.apiSecret = apiSecret || process.env.BINANCE_API_SECRET || '';
      this.baseUrl = 'https://api.binance.com';
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      if (this.apiKey && this.apiSecret) {
        const timestamp = Date.now();
        const query = `timestamp=${timestamp}`;
        const signature = await this._sign(query);
        const res = await fetch(`${this.baseUrl}/api/v3/account?${query}&signature=${signature}`, {
          headers: { 'X-MBX-APIKEY': this.apiKey },
        });
        if (res.ok) return true;
      }
      await binanceService.getPrice('BTCUSDT');
      return true;
    } catch {
      return false;
    }
  }

  async getPrice(symbol: string): Promise<number> {
    if (this.baseUrl.includes('testnet')) {
      const normalized = symbol.toUpperCase();
      const res = await fetch(`${this.baseUrl}/api/v3/ticker/price?symbol=${normalized}`);
      if (!res.ok) throw new Error(`Par no disponible en Binance testnet: ${normalized}`);
      const data = (await res.json()) as { price: string };
      return parseFloat(data.price);
    }
    return binanceService.getPrice(symbol);
  }

  async executeOrder(order: UnifiedOrder): Promise<OrderResult> {
    const sideUpper = order.side.toUpperCase() as 'BUY' | 'SELL';
    return this._executeOrder(order, sideUpper);
  }

  async getPositions(): Promise<BrokerPosition[]> {
    if (!this.apiKey) return [];

    try {
      const timestamp = Date.now();
      const query = `timestamp=${timestamp}`;
      const signature = await this._sign(query);
      const res = await fetch(
        `${this.baseUrl}/api/v3/openOrders?${query}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': this.apiKey } }
      );
      if (!res.ok) return [];
      const orders = (await res.json()) as any[];
      return orders.map((o) => ({
        broker: this.brokerId,
        ticket: o.orderId,
        symbol: o.symbol,
        side: o.side.toLowerCase() as 'buy' | 'sell',
        quantity: parseFloat(o.origQty),
        openPrice: parseFloat(o.price),
        currentPrice: parseFloat(o.price),
        profit: 0,
        openTime: new Date(o.time).toISOString(),
        comment: `Binance Order #${o.orderId}`,
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
        ticket,
        symbol: '',
        side: 'sell',
        error: 'Sin credenciales Binance para cerrar la posición',
      };
    }

    try {
      const timestamp = Date.now();
      const query = `orderId=${ticket}&timestamp=${timestamp}`;
      const signature = await this._sign(query);
      const res = await fetch(`${this.baseUrl}/api/v3/order?${query}&signature=${signature}`, {
        method: 'DELETE',
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        return {
          success: true,
          broker: this.brokerId,
          ticket,
          symbol: data.symbol || '',
          side: (data.side || 'sell').toLowerCase() as 'buy' | 'sell',
          raw: data,
        };
      }
      return {
        success: false,
        broker: this.brokerId,
        ticket,
        symbol: data.symbol || '',
        side: 'sell',
        error: data.msg || 'Binance spot no cierra por ticket; se enviará orden de sentido contrario',
        raw: data,
      };
    } catch (err: any) {
      return {
        success: false,
        broker: this.brokerId,
        ticket,
        symbol: '',
        side: 'sell',
        error: err.message || 'Error al cerrar en Binance',
      };
    }
  }

  private async _executeOrder(order: UnifiedOrder, side: 'BUY' | 'SELL'): Promise<OrderResult> {
    const symbol = order.symbol.toUpperCase();
    const quantity = order.quantity ?? order.lot ?? 0;

    if (!this.apiKey || !this.apiSecret) {
      if (process.env.PAPER_TRADING === 'true') {
        const price = await this.getPrice(symbol).catch(() => 0);
        return {
          success: true,
          broker: this.brokerId,
          ticket: `SIMULATED-${Date.now()}`,
          symbol,
          side: side.toLowerCase() as 'buy' | 'sell',
          quantity,
          executedPrice: price,
          raw: {
            mode: 'paper_trading',
            message: 'PAPER_TRADING=true. Conecta una cuenta Binance para operar en real.',
          },
        };
      }
      return {
        success: false,
        broker: this.brokerId,
        symbol,
        side: side.toLowerCase() as 'buy' | 'sell',
        error: 'Sin credenciales Binance. Conecta una cuenta o activa PAPER_TRADING=true.',
      };
    }

    try {
      const timestamp = Date.now();
      const query = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
      const signature = await this._sign(query);
      const res = await fetch(`${this.baseUrl}/api/v3/order?${query}&signature=${signature}`, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        return {
          success: false,
          broker: this.brokerId,
          symbol,
          side: side.toLowerCase() as 'buy' | 'sell',
          error: data.msg || 'Error en Binance',
          raw: data,
        };
      }
      return {
        success: true,
        broker: this.brokerId,
        ticket: data.orderId,
        symbol: data.symbol,
        side: data.side.toLowerCase() as 'buy' | 'sell',
        quantity: parseFloat(data.executedQty),
        executedPrice: parseFloat(data.fills?.[0]?.price || '0'),
        raw: data,
      };
    } catch (err: any) {
      return {
        success: false,
        broker: this.brokerId,
        symbol,
        side: side.toLowerCase() as 'buy' | 'sell',
        error: err.message,
      };
    }
  }

  private async _sign(query: string): Promise<string> {
    const { createHmac } = await import('crypto');
    return createHmac('sha256', this.apiSecret).update(query).digest('hex');
  }
}
