import ccxt, { type Exchange } from 'ccxt';
import { BrokerAccountType, BrokerEnvironment } from '../../types';

export type CcxtBrokerId = 'binance' | 'bybit';

export interface CcxtExchangeOptions {
  apiKey?: string;
  secret?: string;
  environment?: BrokerEnvironment;
  accountType?: BrokerAccountType;
}

/** Compact BTCUSDT → CCXT BTC/USDT or BTC/USDT:USDT (swap). */
export function toCcxtSymbol(compact: string, marketType: 'spot' | 'swap' = 'spot'): string {
  const s = compact.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const quotes = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'USD', 'BTC', 'ETH'];
  for (const q of quotes) {
    if (s.endsWith(q) && s.length > q.length) {
      const base = s.slice(0, -q.length);
      return marketType === 'swap' ? `${base}/${q}:${q}` : `${base}/${q}`;
    }
  }
  if (s.includes('/')) return s;
  return s;
}

export function createCcxtExchange(broker: CcxtBrokerId, options: CcxtExchangeOptions = {}): Exchange {
  const apiKey = options.apiKey || '';
  const secret = options.secret || '';
  const testnet = options.environment === 'testnet';
  const defaultType =
    broker === 'bybit' && options.accountType === 'futures' ? 'swap' : 'spot';

  const common = {
    apiKey: apiKey || undefined,
    secret: secret || undefined,
    enableRateLimit: true,
    timeout: 12_000,
    options: { defaultType },
  };

  let exchange: Exchange;
  if (broker === 'binance') {
    exchange = new ccxt.binance(common);
  } else {
    exchange = new ccxt.bybit(common);
  }

  if (testnet && typeof exchange.setSandboxMode === 'function') {
    exchange.setSandboxMode(true);
  }

  return exchange;
}

export function marketTypeOf(exchange: Exchange): 'spot' | 'swap' {
  const t = String((exchange.options as { defaultType?: string } | undefined)?.defaultType || 'spot');
  return t === 'swap' || t === 'future' || t === 'linear' ? 'swap' : 'spot';
}
