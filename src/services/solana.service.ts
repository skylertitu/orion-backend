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
import { metaForMint, pinnedUtilityMints } from '../config/splTokens';
import { isSolanaAddress } from '../utils/solanaVerify';
import { logger } from '../utils/logger';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';

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
  const connection = getSolanaConnection();
  const cluster = getSolanaCluster();
  const [lamports, tokens] = await Promise.all([
    connection.getBalance(pubkey),
    getSplTokenBalances(pubkey).catch((err) => {
      logger.warn(`[solana] tokens: ${err instanceof Error ? err.message : 'error'}`);
      return [] as SplTokenBalance[];
    }),
  ]);
  return {
    address,
    cluster,
    executionMode: getSolanaExecutionMode(),
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
    explorerUrl: explorerAddressUrl(address),
    tokens: withPinnedUtilities(cluster, tokens),
  };
}

export type SplTokenBalance = {
  mint: string;
  symbol: string;
  name: string;
  initials: string;
  decimals: number;
  amount: string;
  uiAmount: number;
};

async function getSplTokenBalances(owner: PublicKey): Promise<SplTokenBalance[]> {
  const connection = getSolanaConnection();
  const [legacy, token2022] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);
  const byMint = new Map<string, SplTokenBalance>();
  for (const row of [...legacy.value, ...token2022.value]) {
    const data = row.account.data as {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: {
            uiAmount?: number | null;
            uiAmountString?: string;
            decimals?: number;
            amount?: string;
          };
        };
      };
    };
    const info = data.parsed?.info;
    const tokenAmount = info?.tokenAmount;
    const mint = String(info?.mint || '');
    if (!mint || mint === WRAPPED_SOL) continue;
    const uiAmount = Number(tokenAmount?.uiAmount ?? tokenAmount?.uiAmountString ?? 0);
    const meta = metaForMint(mint);
    const prev = byMint.get(mint);
    const nextAmount = (prev?.uiAmount || 0) + (Number.isFinite(uiAmount) ? uiAmount : 0);
    byMint.set(mint, {
      mint,
      symbol: meta.symbol,
      name: meta.name,
      initials: meta.initials,
      decimals: Number(tokenAmount?.decimals ?? 0),
      amount: String(tokenAmount?.amount || '0'),
      uiAmount: nextAmount,
    });
  }
  return [...byMint.values()].sort((a, b) => b.uiAmount - a.uiAmount);
}

function withPinnedUtilities(cluster: string, held: SplTokenBalance[]): SplTokenBalance[] {
  const rows = [...held];
  for (const pin of pinnedUtilityMints(cluster)) {
    const already = rows.some((row) => row.symbol === pin.symbol || row.mint === pin.mint);
    if (already) continue;
    const heldSameSymbol = held.find((row) => row.symbol === pin.symbol);
    if (heldSameSymbol) continue;
    rows.push({
      mint: pin.mint,
      symbol: pin.symbol,
      name: pin.name,
      initials: pin.initials,
      decimals: 6,
      amount: '0',
      uiAmount: 0,
    });
  }
  const order = ['USDC', 'EURC', 'USDT'];
  return rows.sort((a, b) => {
    const ai = order.indexOf(a.symbol);
    const bi = order.indexOf(b.symbol);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return b.uiAmount - a.uiAmount;
  });
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
