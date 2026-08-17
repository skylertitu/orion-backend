import { IncomingMessage } from 'http';
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { binanceWs, WsKline } from '../services/binanceWs';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

interface WsClient {
  ws: WebSocket;
  userId: number;
  symbols: Set<string>;
}

const clients = new Set<WsClient>();

function tokenFromRequest(req: IncomingMessage): string | null {
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/ws/market', `http://${host}`);
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;
  } catch {
    /* ignore */
  }
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function setupMarketWs(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/market' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const payload = verifyToken(tokenFromRequest(req) || '');
    const client: WsClient = {
      ws,
      userId: payload?.id || 0,
      symbols: new Set(),
    };
    clients.add(client);
    logger.info(`[MarketWS] Cliente user=${client.userId || 'anon'} (${clients.size} total)`);

    ws.on('message', async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleClientMessage(client, msg);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Mensaje inválido' }));
      }
    });

    ws.on('close', () => {
      void releaseClientSubscriptions(client);
      clients.delete(client);
      logger.info(`[MarketWS] Cliente desconectado (${clients.size} total)`);
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Orion Market WebSocket' }));
  });

  binanceWs.on('kline', (kline: WsKline) => {
    broadcast({
      type: 'kline',
      data: {
        symbol: kline.symbol,
        interval: kline.interval,
        time: kline.openTime,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        isFinal: kline.isFinal,
      },
    }, `${kline.symbol}_${kline.interval}`);
  });

  binanceWs.on('kline_closed', (kline: WsKline) => {
    broadcast({
      type: 'kline_closed',
      data: {
        symbol: kline.symbol,
        interval: kline.interval,
        time: kline.openTime,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
      },
    }, `${kline.symbol}_${kline.interval}`);
  });

  binanceWs.on('trade', (trade: any) => {
    broadcast({
      type: 'trade',
      data: {
        symbol: trade.symbol,
        price: trade.price,
        quantity: trade.quantity,
        time: trade.time,
        side: trade.isBuyerMaker ? 'sell' : 'buy',
      },
    }, trade.symbol);
  });

  logger.info('[MarketWS] WebSocket server configurado en /ws/market');
}

async function handleClientMessage(client: WsClient, msg: any): Promise<void> {
  switch (msg.type) {
    case 'subscribe':
      if (msg.symbol) {
        const symbol = String(msg.symbol).toUpperCase();
        const interval = msg.interval || '1m';
        const key = `${symbol}_${interval}`;
        if (!client.symbols.has(key)) {
          client.symbols.add(key);
          await binanceWs.subscribe(symbol, interval);
        }

        const klines = binanceWs.getKlines(symbol, interval);
        if (klines.length > 0) {
          client.ws.send(JSON.stringify({
            type: 'snapshot',
            data: {
              symbol,
              interval,
              klines: klines.map((k) => ({
                time: k.openTime,
                open: k.open,
                high: k.high,
                low: k.low,
                close: k.close,
                volume: k.volume,
              })),
              price: binanceWs.getLatestPrice(symbol),
            },
          }));
        }
      }
      break;

    case 'unsubscribe':
      if (msg.symbol) {
        const symbol = String(msg.symbol).toUpperCase();
        const interval = msg.interval || '1m';
        const key = `${symbol}_${interval}`;
        if (client.symbols.delete(key)) {
          binanceWs.unsubscribe(symbol, interval);
        }
      }
      break;

    case 'price':
      if (msg.symbol) {
        const price = binanceWs.getLatestPrice(String(msg.symbol).toUpperCase());
        client.ws.send(JSON.stringify({ type: 'price', data: { symbol: msg.symbol, price } }));
      }
      break;
  }
}

async function releaseClientSubscriptions(client: WsClient): Promise<void> {
  for (const key of client.symbols) {
    const [symbol, interval] = key.split('_');
    if (symbol && interval) binanceWs.unsubscribe(symbol, interval);
  }
  client.symbols.clear();
}

function clientWants(client: WsClient, channel: string): boolean {
  if (client.symbols.has(channel)) return true;
  for (const key of client.symbols) {
    if (key.startsWith(`${channel}_`)) return true;
  }
  return false;
}

function broadcast(message: any, channel: string): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    if (!clientWants(client, channel)) continue;
    client.ws.send(payload);
  }
}
