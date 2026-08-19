import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  explorerAddressUrl,
  explorerTxUrl,
  getSolanaCluster,
  getSolanaExecutionMode,
  getSolanaRpcUrl,
  rpcHostHint,
  solanaFaucetUrl,
  solanaNetworkPublic,
} from '../config/solana';
import { isSolanaAddress } from '../utils/solanaVerify';
import { logger } from '../utils/logger';

let connection: Connection | null = null;

function httpError(message: string, status: number) {
  const err: Error & { status?: number } = new Error(message);
  err.status = status;
  return err;
}

export function getSolanaConnection(): Connection {
  if (!connection) {
    connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  }
  return connection;
}

export async function getOnChainSolBalance(address: string) {
  if (!isSolanaAddress(address)) {
    throw httpError('Dirección Solana inválida', 400);
  }
  const pubkey = new PublicKey(address);
  const lamports = await getSolanaConnection().getBalance(pubkey);
  return {
    address,
    cluster: getSolanaCluster(),
    executionMode: getSolanaExecutionMode(),
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
    explorerUrl: explorerAddressUrl(address),
  };
}

export async function requestDevnetAirdrop(address: string, sol = 1) {
  if (getSolanaCluster() !== 'devnet') {
    throw httpError('El airdrop solo está disponible cuando SOLANA_CLUSTER=devnet', 400);
  }
  if (!isSolanaAddress(address)) {
    throw httpError('Dirección Solana inválida', 400);
  }
  const amount = Math.min(Math.max(sol, 0.1), 2);
  const pubkey = new PublicKey(address);
  try {
    const signature = await getSolanaConnection().requestAirdrop(
      pubkey,
      Math.round(amount * LAMPORTS_PER_SOL)
    );
    const latest = await getSolanaConnection().getLatestBlockhash();
    await getSolanaConnection().confirmTransaction({ signature, ...latest }, 'confirmed');
    const balance = await getOnChainSolBalance(address);
    return {
      ...balance,
      signature,
      explorerUrl: explorerTxUrl(signature),
      faucetUrl: solanaFaucetUrl(),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Airdrop rechazado';
    logger.warn(`[solana] airdrop falló: ${detail}`);
    throw httpError(
      `El RPC no dio SOL de prueba (${detail.slice(0, 120)}). Usa ${solanaFaucetUrl()} con tu public key.`,
      502
    );
  }
}

export async function pingSolanaRpc(): Promise<{
  ok: boolean;
  cluster: ReturnType<typeof getSolanaCluster>;
  executionMode: ReturnType<typeof getSolanaExecutionMode>;
  rpcHost: string;
  error?: string;
}> {
  const cluster = getSolanaCluster();
  const executionMode = getSolanaExecutionMode();
  const rpcHost = rpcHostHint();
  try {
    await getSolanaConnection().getLatestBlockhash();
    return { ok: true, cluster, executionMode, rpcHost };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'RPC Solana no responde';
    logger.warn(`[solana] rpc ping: ${error}`);
    return { ok: false, cluster, executionMode, rpcHost, error };
  }
}

export function getSolanaNetworkStatus() {
  return solanaNetworkPublic();
}
