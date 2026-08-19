import { clusterApiUrl } from '@solana/web3.js';

export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta';
export type SolanaExecutionMode = 'demo' | 'live';

function parseCluster(raw: string): SolanaCluster {
  const value = raw.trim().toLowerCase();
  if (value === 'mainnet' || value === 'mainnet-beta') return 'mainnet-beta';
  if (value === 'testnet') return 'testnet';
  return 'devnet';
}

export function getSolanaCluster(): SolanaCluster {
  return parseCluster(process.env.SOLANA_CLUSTER || 'devnet');
}

export function getSolanaExecutionMode(): SolanaExecutionMode {
  const raw = (process.env.SOLANA_EXECUTION_MODE || '').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'demo') return 'demo';
  return getSolanaCluster() === 'mainnet-beta' ? 'live' : 'demo';
}

export function getSolanaRpcUrl(): string {
  const custom = (process.env.SOLANA_RPC_URL || '').trim();
  return custom || clusterApiUrl(getSolanaCluster());
}

export function rpcHostHint(url = getSolanaRpcUrl()): string {
  try {
    return new URL(url).host;
  } catch {
    return 'rpc';
  }
}

export function explorerTxUrl(signature: string): string {
  const cluster = getSolanaCluster();
  const base = `https://solscan.io/tx/${signature}`;
  return cluster === 'mainnet-beta' ? base : `${base}?cluster=${cluster}`;
}

export function explorerAddressUrl(address: string): string {
  const cluster = getSolanaCluster();
  const base = `https://solscan.io/account/${address}`;
  return cluster === 'mainnet-beta' ? base : `${base}?cluster=${cluster}`;
}

export function solanaFaucetUrl(): string {
  return 'https://faucet.solana.com';
}

export function solanaNetworkPublic() {
  const cluster = getSolanaCluster();
  const executionMode = getSolanaExecutionMode();
  return {
    cluster,
    executionMode,
    rpcHost: rpcHostHint(),
    faucetUrl: cluster === 'mainnet-beta' ? null : solanaFaucetUrl(),
    phantomHint:
      cluster === 'mainnet-beta'
        ? 'Phantom en Mainnet. Cada swap pide aprobación y mueve fondos reales.'
        : 'En Phantom: Configuración → Developer Settings → activa Developer Mode y elige Devnet.',
  };
}
