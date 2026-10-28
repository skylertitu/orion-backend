import type { Exchange, Order } from 'ccxt';
import { BrokerId, BrokerPosition, OrderResult, UnifiedOrder } from '../engine.types';
import { marketTypeOf, toCcxtSymbol } from './ccxtFactory';

function sideOf(side: string): 'buy' | 'sell' {
  return side.toLowerCase() === 'sell' ? 'sell' : 'buy';
}

export async function ccxtFetchPrice(exchange: Exchange, compactSymbol: string): Promise<number> {
  const symbol = toCcxtSymbol(compactSymbol, marketTypeOf(exchange));
  const ticker = await exchange.fetchTicker(symbol);
  const price = Number(ticker.last ?? ticker.close ?? ticker.bid ?? 0);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Precio CCXT no disponible para ${symbol}`);
  }
  return price;
}

export async function ccxtPing(exchange: Exchange, hasCredentials: boolean): Promise<boolean> {
  await ccxtFetchPrice(exchange, 'BTCUSDT');
  if (!hasCredentials) return true;
  await exchange.fetchBalance();
  return true;
}

export async function ccxtMarketOrder(
  exchange: Exchange,
  brokerId: BrokerId,
  order: UnifiedOrder
): Promise<OrderResult> {
  const qty = order.quantity ?? order.lot ?? 0;
  const symbol = toCcxtSymbol(order.symbol, marketTypeOf(exchange));
  const side = sideOf(order.side);

  const params: Record<string, unknown> = {};
  if (order.clientOrderId) {
    params.clientOrderId = order.clientOrderId;
  }
  const created = await exchange.createOrder(symbol, 'market', side, qty, undefined, params);
  return mapOrderResult(brokerId, created, side, qty);
}

export async function ccxtListPositions(
  exchange: Exchange,
  brokerId: BrokerId
): Promise<BrokerPosition[]> {
  const type = marketTypeOf(exchange);

  if (type === 'swap' && exchange.has['fetchPositions']) {
    const positions = await exchange.fetchPositions();
    return positions
      .filter((p) => Math.abs(Number(p.contracts ?? p.contractSize ?? 0)) > 0 || Math.abs(Number(p.notional ?? 0)) > 0)
      .map((p) => {
        const contracts = Math.abs(Number(p.contracts ?? 0));
        const side = (p.side === 'short' ? 'sell' : 'buy') as 'buy' | 'sell';
        return {
          broker: brokerId,
          ticket: String(p.id || p.symbol || ''),
          symbol: compactFromCcxt(String(p.symbol || '')),
          side,
          quantity: contracts || Math.abs(Number(p.notional ?? 0)),
          openPrice: Number(p.entryPrice ?? 0),
          currentPrice: Number(p.markPrice ?? p.entryPrice ?? 0),
          profit: Number(p.unrealizedPnl ?? 0),
          comment: `CCXT ${p.symbol}`,
        } satisfies BrokerPosition;
      });
  }

  if (!exchange.has['fetchOpenOrders']) return [];
  const orders = await exchange.fetchOpenOrders();
  return orders.map((o) => ({
    broker: brokerId,
    ticket: o.id,
    symbol: compactFromCcxt(String(o.symbol || '')),
    side: sideOf(String(o.side || 'buy')),
    quantity: Number(o.amount ?? 0),
    openPrice: Number(o.price ?? o.average ?? 0),
    currentPrice: Number(o.price ?? o.average ?? 0),
    profit: 0,
    openTime: o.timestamp ? new Date(o.timestamp).toISOString() : undefined,
    comment: `CCXT Order #${o.id}`,
  }));
}

export async function ccxtClosePosition(
  exchange: Exchange,
  brokerId: BrokerId,
  ticket: string | number
): Promise<OrderResult> {
  const type = marketTypeOf(exchange);
  const id = String(ticket);

  if (type === 'swap') {
    const positions = await ccxtListPositions(exchange, brokerId);
    const position = positions.find((p) => String(p.ticket) === id || p.symbol === id);
    if (!position) {
      return {
        success: false,
        broker: brokerId,
        ticket,
        symbol: '',
        side: 'sell',
        error: 'Posición no encontrada (CCXT)',
      };
    }
    const closeSide = position.side === 'buy' ? 'sell' : 'buy';
    const symbol = toCcxtSymbol(position.symbol, 'swap');
    const created = await exchange.createOrder(symbol, 'market', closeSide, position.quantity || 0, undefined, {
      reduceOnly: true,
    });
    return mapOrderResult(brokerId, created, closeSide, position.quantity || 0);
  }

  if (!exchange.has['cancelOrder']) {
    return {
      success: false,
      broker: brokerId,
      ticket,
      symbol: '',
      side: 'sell',
      error: 'CCXT no soporta cancelar en este mercado',
    };
  }

  const cancelled = (await exchange.cancelOrder(id)) as Order;
  return mapOrderResult(brokerId, cancelled, sideOf(String(cancelled.side || 'sell')), Number(cancelled.amount || 0));
}

export async function ccxtFetchOhlcv(
  exchange: Exchange,
  compactSymbol: string,
  timeframe: string,
  limit: number
): Promise<Array<[number, number, number, number, number, number]>> {
  const symbol = toCcxtSymbol(compactSymbol, marketTypeOf(exchange));
  const rows = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  return rows.map((r) => [
    Number(r[0]),
    Number(r[1]),
    Number(r[2]),
    Number(r[3]),
    Number(r[4]),
    Number(r[5] ?? 0),
  ]);
}

function compactFromCcxt(symbol: string): string {
  return symbol.replace(/[:/]/g, '').toUpperCase().replace(/USDTUSDT$/, 'USDT');
}

function mapOrderResult(
  brokerId: BrokerId,
  order: Order,
  side: 'buy' | 'sell',
  fallbackQty: number
): OrderResult {
  return {
    success: true,
    broker: brokerId,
    ticket: order.id,
    symbol: compactFromCcxt(String(order.symbol || '')),
    side,
    quantity: Number(order.filled ?? order.amount ?? fallbackQty) || fallbackQty,
    executedPrice: Number(order.average ?? order.price ?? 0) || undefined,
    raw: { ...order, via: 'ccxt' },
  };
}
