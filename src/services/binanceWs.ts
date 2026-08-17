import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface WsKline {
  symbol: string;
  interval: string;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  isFinal: boolean;
}

export interface WsTrade {
  symbol: string;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  klines: WsKline[];
  lastUpdate: number;
}

const KLINE_BUFFER_SIZE = 500;

class BinanceWsService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions = new Map<string, string>();
  private refCounts = new Map<string, number>();
  private klineBuffers = new Map<string, WsKline[]>();
  private latestPrices = new Map<string, number>();
  private connected = false;
  private readonly wsUrls = [
    'wss://data-stream.binance.vision/ws',
    'wss://stream.binance.com:9443/ws',
  ];
  private wsUrlIndex = 0;
  private readonly reconnectDelay = 3000;
  private readonly maxReconnectDelay = 30000;

  async subscribe(symbol: string, interval: string = '1m'): Promise<void> {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    const refs = (this.refCounts.get(stream) || 0) + 1;
    this.refCounts.set(stream, refs);
    if (refs > 1) return;

    this.subscriptions.set(stream, stream);
    logger.info(`[WsFeed] Suscribiendo a ${symbol} ${interval}`);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    } else {
      this.sendSubscribe([stream]);
    }
  }

  async subscribeTrades(symbol: string): Promise<void> {
    const stream = `${symbol.toLowerCase()}@trade`;
    const refs = (this.refCounts.get(stream) || 0) + 1;
    this.refCounts.set(stream, refs);
    if (refs > 1) return;

    this.subscriptions.set(stream, stream);
    logger.info(`[WsFeed] Suscribiendo trades ${symbol}`);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    } else {
      this.sendSubscribe([stream]);
    }
  }

  unsubscribe(symbol: string, interval: string = '1m'): void {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    const refs = (this.refCounts.get(stream) || 0) - 1;
    if (refs > 0) {
      this.refCounts.set(stream, refs);
      return;
    }
    this.refCounts.delete(stream);
    this.subscriptions.delete(stream);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.sendUnsubscribe([stream]);
    logger.info(`[WsFeed] Unsubscribe ${symbol} ${interval} (sin más oyentes)`);
  }

  getKlines(symbol: string, interval: string = '1m'): WsKline[] {
    return this.klineBuffers.get(`${symbol}_${interval}`) || [];
  }

  getLatestPrice(symbol: string): number {
    return this.latestPrices.get(symbol.toUpperCase()) || 0;
  }

  getSnapshot(symbol: string, interval: string = '1m'): MarketSnapshot {
    return {
      symbol,
      price: this.getLatestPrice(symbol),
      klines: this.getKlines(symbol, interval),
      lastUpdate: Date.now(),
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  private connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = this.wsUrls[this.wsUrlIndex % this.wsUrls.length];
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        logger.info(`[WsFeed] Conectado a Binance WebSocket (${url})`);
        this.sendSubscribe();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
          this.handleMessage(msg);
        } catch { /* ignore parse errors */ }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.wsUrlIndex = (this.wsUrlIndex + 1) % this.wsUrls.length;
        logger.warn('[WsFeed] Desconectado. Reconectando...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err: Event) => {
        logger.error('[WsFeed] Error en WebSocket');
        this.connected = false;
      };
    } catch (err: any) {
      logger.error(`[WsFeed] Error al crear WebSocket: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
  }

  private sendSubscribe(streams?: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const params = streams && streams.length > 0 ? streams : [...this.subscriptions.values()];
    if (params.length === 0) return;
    this.ws.send(JSON.stringify({ method: 'SUBSCRIBE', params, id: Date.now() }));
  }

  private sendUnsubscribe(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: streams, id: Date.now() }));
  }

  private handleMessage(msg: any): void {
    if (msg.e === 'kline') {
      this.handleKline(msg);
    } else if (msg.e === 'trade') {
      this.handleTrade(msg);
    }
  }

  private handleKline(msg: any): void {
    const k = msg.k;
    const symbol = k.s;
    const interval = k.i;
    const bufferKey = `${symbol}_${interval}`;

    const kline: WsKline = {
      symbol,
      interval,
      openTime: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
      closeTime: k.T,
      isFinal: k.x,
    };

    this.latestPrices.set(symbol, kline.close);

    const buffer = this.klineBuffers.get(bufferKey) || [];
    const lastIdx = buffer.length - 1;

    if (lastIdx >= 0 && buffer[lastIdx].openTime === kline.openTime) {
      buffer[lastIdx] = kline;
    } else {
      buffer.push(kline);
      if (buffer.length > KLINE_BUFFER_SIZE) buffer.shift();
    }
    this.klineBuffers.set(bufferKey, buffer);

    this.emit('kline', kline);

    if (kline.isFinal) {
      this.emit('kline_closed', kline);
    }
  }

  private handleTrade(msg: any): void {
    const trade: WsTrade = {
      symbol: msg.s,
      price: parseFloat(msg.p),
      quantity: parseFloat(msg.q),
      time: msg.T,
      isBuyerMaker: msg.m,
    };
    this.latestPrices.set(trade.symbol, trade.price);
    this.emit('trade', trade);
  }
}

export const binanceWs = new BinanceWsService();
