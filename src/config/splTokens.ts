export type SplTokenMeta = {
  symbol: string;
  name: string;
  initials: string;
  mint: string;
};

const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJg1PQmL4B';
const USDC_DEVNET_FAUCET = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
const EURC_MAINNET = 'HzwqbKZw8HxMN6bF2yFZNuDh5AQe4GCw6uCtCTwKDkuB';
const USDT_MAINNET = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

export const SPL_TOKEN_CATALOG: SplTokenMeta[] = [
  { symbol: 'USDC', name: 'USD Coin', initials: 'US', mint: USDC_MAINNET },
  { symbol: 'USDC', name: 'USD Coin', initials: 'US', mint: USDC_DEVNET },
  { symbol: 'USDC', name: 'USD Coin', initials: 'US', mint: USDC_DEVNET_FAUCET },
  { symbol: 'EURC', name: 'EUR Coin', initials: 'EU', mint: EURC_MAINNET },
  { symbol: 'USDT', name: 'Tether', initials: 'TD', mint: USDT_MAINNET },
  { symbol: 'JUP', name: 'Jupiter', initials: 'JU', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'RAY', name: 'Raydium', initials: 'RA', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { symbol: 'WIF', name: 'dogwifhat', initials: 'WF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'BONK', name: 'Bonk', initials: 'BK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JTO', name: 'Jito', initials: 'JT', mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL' },
  { symbol: 'PYTH', name: 'Pyth Network', initials: 'PY', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' },
];

const BY_MINT = new Map(SPL_TOKEN_CATALOG.map((row) => [row.mint, row]));

export function metaForMint(mint: string): SplTokenMeta {
  const known = BY_MINT.get(mint);
  if (known) return known;
  return {
    symbol: mint.slice(0, 4).toUpperCase(),
    name: 'SPL token',
    initials: mint.slice(0, 2).toUpperCase(),
    mint,
  };
}

export function pinnedUtilityMints(cluster: string): SplTokenMeta[] {
  if (cluster === 'devnet' || cluster === 'testnet') {
    return [
      { symbol: 'USDC', name: 'USD Coin', initials: 'US', mint: USDC_DEVNET },
      { symbol: 'EURC', name: 'EUR Coin', initials: 'EU', mint: EURC_MAINNET },
    ];
  }
  return [
    { symbol: 'USDC', name: 'USD Coin', initials: 'US', mint: USDC_MAINNET },
    { symbol: 'EURC', name: 'EUR Coin', initials: 'EU', mint: EURC_MAINNET },
  ];
}
