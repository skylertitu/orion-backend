export const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

export type BinanceNetwork = 'bitcoin' | 'ethereum' | 'solana' | 'bnb' | 'other';

export interface BinancePair {
  symbol: string;
  base: string;
  name: string;
  network: BinanceNetwork;
}

export const BINANCE_PAIRS: BinancePair[] = [
  { symbol: 'BTCUSDT', base: 'BTC', name: 'Bitcoin', network: 'bitcoin' },
  { symbol: 'ETHUSDT', base: 'ETH', name: 'Ethereum', network: 'ethereum' },
  { symbol: 'BNBUSDT', base: 'BNB', name: 'BNB', network: 'bnb' },
  { symbol: 'XRPUSDT', base: 'XRP', name: 'XRP', network: 'other' },
  { symbol: 'SOLUSDT', base: 'SOL', name: 'Solana', network: 'solana' },
  { symbol: 'JUPUSDT', base: 'JUP', name: 'Jupiter', network: 'solana' },
  { symbol: 'RAYUSDT', base: 'RAY', name: 'Raydium', network: 'solana' },
  { symbol: 'WIFUSDT', base: 'WIF', name: 'dogwifhat', network: 'solana' },
  { symbol: 'BONKUSDT', base: 'BONK', name: 'Bonk', network: 'solana' },
  { symbol: 'DOGEUSDT', base: 'DOGE', name: 'Dogecoin', network: 'other' },
  { symbol: 'ADAUSDT', base: 'ADA', name: 'Cardano', network: 'other' },
  { symbol: 'LINKUSDT', base: 'LINK', name: 'Chainlink', network: 'other' },
  { symbol: 'LTCUSDT', base: 'LTC', name: 'Litecoin', network: 'other' },
  { symbol: 'DOTUSDT', base: 'DOT', name: 'Polkadot', network: 'other' },
  { symbol: 'TRXUSDT', base: 'TRX', name: 'TRON', network: 'other' },
  { symbol: 'PEPEUSDT', base: 'PEPE', name: 'Pepe', network: 'ethereum' },
  { symbol: 'SUIUSDT', base: 'SUI', name: 'Sui', network: 'other' },
  { symbol: 'TONUSDT', base: 'TON', name: 'Toncoin', network: 'other' },
];

export const BINANCE_SYMBOLS = BINANCE_PAIRS.map((p) => p.symbol);

export function normalizeSymbol(input: string): string {
  const upper = input.toUpperCase().trim();
  if (BINANCE_SYMBOLS.includes(upper)) return upper;
  const withQuote = upper.endsWith('USDT') ? upper : `${upper}USDT`;
  return withQuote;
}

export function isValidBinanceSymbol(symbol: string): boolean {
  const normalized = normalizeSymbol(symbol);
  return BINANCE_SYMBOLS.includes(normalized) || (normalized.endsWith('USDT') && normalized.length >= 5);
}
