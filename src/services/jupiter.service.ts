import IntegrationSecret from '../models/IntegrationSecret';
import { decryptSecret, encryptSecret } from '../utils/crypto';
import { findJupiterToken, JUPITER_TOKENS, JupiterToken } from '../config/jupiterTokens';
import { explorerTxUrl, getSolanaCluster, getSolanaExecutionMode } from '../config/solana';
import { pingSolanaRpc } from '../services/solana.service';
import { logger } from '../utils/logger';

const PRICE_URL = 'https://api.jup.ag/price/v3';
const QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';
const ORDER_URL = 'https://api.jup.ag/swap/v2/order';
const EXECUTE_URL = 'https://api.jup.ag/swap/v2/execute';
const JUPITER_ID = 'jupiter';

export type JupiterPriceRow = {
  symbol: string;
  name: string;
  mint: string;
  usdPrice: number | null;
  change24h: number | null;
  liquidity: number | null;
  decimals: number;
};

export type JupiterQuoteResult = {
  input: JupiterToken;
  output: JupiterToken;
  inAmount: string;
  outAmount: string;
  inUi: number;
  outUi: number;
  price: number;
  priceImpactPct: number | null;
  routePlanCount: number;
};

export type JupiterOrderResult = JupiterQuoteResult & {
  requestId: string;
  transaction: string;
  router?: string;
  taker: string;
};

export type JupiterExecuteResult = {
  status: 'Success' | 'Failed';
  signature?: string;
  error?: string;
  code?: number;
  inputAmountResult?: string;
  outputAmountResult?: string;
  solscanUrl?: string;
  simulated?: boolean;
  cluster?: string;
  executionMode?: string;
};

export type JupiterStatus = {
  connected: boolean;
  hasKey: boolean;
  keySource: 'env' | 'database' | 'none';
  keyHint: string | null;
  error?: string;
  sample?: { symbol: string; usdPrice: number };
  solana?: {
    cluster: string;
    executionMode: string;
    rpcOk: boolean;
    rpcHost: string;
    error?: string;
  };
};

function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

async function loadStoredKey(): Promise<string> {
  const row = await IntegrationSecret.findByPk(JUPITER_ID);
  if (!row?.secretEnc) return '';
  try {
    return decryptSecret(row.secretEnc);
  } catch {
    return '';
  }
}

export async function getJupiterApiKey(): Promise<{ key: string; source: JupiterStatus['keySource'] }> {
  const envKey = (process.env.JUPITER_API_KEY || '').trim();
  if (envKey) return { key: envKey, source: 'env' };
  const stored = await loadStoredKey();
  if (stored) return { key: stored, source: 'database' };
  return { key: '', source: 'none' };
}

export async function setJupiterApiKey(apiKey: string, updatedBy?: number): Promise<void> {
  const trimmed = apiKey.trim();
  await IntegrationSecret.upsert({
    id: JUPITER_ID,
    secretEnc: trimmed ? encryptSecret(trimmed) : null,
    updatedBy: updatedBy ?? null,
  });
}

function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  return headers;
}

async function jupiterGet(url: string, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, { headers: authHeaders(apiKey), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function jupiterPost(url: string, apiKey: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function quoteFromAmounts(
  input: JupiterToken,
  output: JupiterToken,
  inAmount: string,
  outAmount: string,
  extra?: { priceImpactPct?: string | number | null; routePlanCount?: number }
): JupiterQuoteResult {
  const inUi = Number(inAmount) / 10 ** input.decimals;
  const outUi = Number(outAmount) / 10 ** output.decimals;
  const impact = extra?.priceImpactPct == null ? null : Number(extra.priceImpactPct);
  return {
    input,
    output,
    inAmount,
    outAmount,
    inUi,
    outUi,
    price: inUi > 0 ? outUi / inUi : 0,
    priceImpactPct: Number.isFinite(impact) ? impact : null,
    routePlanCount: extra?.routePlanCount ?? 0,
  };
}

export async function getJupiterPrices(): Promise<JupiterPriceRow[]> {
  const { key } = await getJupiterApiKey();
  if (!key) {
    throw Object.assign(new Error('Falta la API key de Jupiter Portal'), { status: 401, code: 'JUPITER_KEY' });
  }

  const ids = JUPITER_TOKENS.map((t) => t.mint).join(',');
  const res = await jupiterGet(`${PRICE_URL}?ids=${encodeURIComponent(ids)}`, key);
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('API key de Jupiter rechazada'), { status: 401, code: 'JUPITER_KEY' });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Jupiter Price API ${res.status}`), { status: 502 });
  }

  const payload = (await res.json()) as Record<
    string,
    { usdPrice?: number; priceChange24h?: number; liquidity?: number; decimals?: number }
  >;

  return JUPITER_TOKENS.map((token) => {
    const row = payload[token.mint];
    return {
      symbol: token.symbol,
      name: token.name,
      mint: token.mint,
      usdPrice: typeof row?.usdPrice === 'number' ? row.usdPrice : null,
      change24h: typeof row?.priceChange24h === 'number' ? row.priceChange24h : null,
      liquidity: typeof row?.liquidity === 'number' ? row.liquidity : null,
      decimals: row?.decimals ?? token.decimals,
    };
  });
}

export async function getJupiterQuote(inputSymbol: string, outputSymbol: string, amountUi: number, slippageBps = 50) {
  const input = findJupiterToken(inputSymbol);
  const output = findJupiterToken(outputSymbol);
  if (!input || !output) {
    throw Object.assign(new Error('Token Jupiter no soportado'), { status: 400 });
  }
  if (!(amountUi > 0)) {
    throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  }

  const { key } = await getJupiterApiKey();
  const lamports = BigInt(Math.round(amountUi * 10 ** input.decimals)).toString();
  const url =
    `${QUOTE_URL}?inputMint=${encodeURIComponent(input.mint)}` +
    `&outputMint=${encodeURIComponent(output.mint)}` +
    `&amount=${lamports}&slippageBps=${Math.max(1, Math.min(1000, slippageBps))}`;

  const res = await jupiterGet(url, key);
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(text.slice(0, 180) || `Jupiter Quote ${res.status}`), { status: res.status >= 400 && res.status < 500 ? res.status : 502 });
  }

  const data = (await res.json()) as {
    inAmount?: string;
    outAmount?: string;
    priceImpactPct?: string | number;
    routePlan?: unknown[];
  };
  const inAmount = data.inAmount || lamports;
  const outAmount = data.outAmount || '0';
  const inUi = Number(inAmount) / 10 ** input.decimals;
  const outUi = Number(outAmount) / 10 ** output.decimals;
  const price = inUi > 0 ? outUi / inUi : 0;
  const impact = data.priceImpactPct == null ? null : Number(data.priceImpactPct);

  const quote: JupiterQuoteResult = {
    input,
    output,
    inAmount,
    outAmount,
    inUi,
    outUi,
    price,
    priceImpactPct: Number.isFinite(impact) ? impact : null,
    routePlanCount: Array.isArray(data.routePlan) ? data.routePlan.length : 0,
  };
  return quote;
}

export async function getJupiterOrder(
  inputSymbol: string,
  outputSymbol: string,
  amountUi: number,
  taker: string,
  slippageBps = 50
): Promise<JupiterOrderResult> {
  const input = findJupiterToken(inputSymbol);
  const output = findJupiterToken(outputSymbol);
  if (!input || !output) {
    throw Object.assign(new Error('Token Jupiter no soportado'), { status: 400 });
  }
  if (!(amountUi > 0)) {
    throw Object.assign(new Error('Cantidad inválida'), { status: 400 });
  }
  const takerAddr = taker.trim();
  if (takerAddr.length < 32) {
    throw Object.assign(new Error('Conecta Phantom para firmar el swap'), { status: 400 });
  }
  if (getSolanaExecutionMode() === 'demo') {
    throw Object.assign(
      new Error('Estás en Demo/Devnet. Usa simular swap; el execute de Jupiter es Mainnet.'),
      { status: 400 }
    );
  }

  const { key } = await getJupiterApiKey();
  if (!key) {
    throw Object.assign(new Error('Falta la API key de Jupiter Portal'), { status: 401, code: 'JUPITER_KEY' });
  }

  const lamports = BigInt(Math.round(amountUi * 10 ** input.decimals)).toString();
  const url =
    `${ORDER_URL}?inputMint=${encodeURIComponent(input.mint)}` +
    `&outputMint=${encodeURIComponent(output.mint)}` +
    `&amount=${lamports}` +
    `&taker=${encodeURIComponent(takerAddr)}` +
    `&slippageBps=${Math.max(1, Math.min(1000, slippageBps))}`;

  const res = await jupiterGet(url, key);
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(text.slice(0, 220) || `Jupiter Order ${res.status}`), {
      status: res.status >= 400 && res.status < 500 ? res.status : 502,
    });
  }

  const data = (await res.json()) as {
    transaction?: string | null;
    requestId?: string;
    inAmount?: string;
    outAmount?: string;
    priceImpactPct?: string | number;
    router?: string;
    errorMessage?: string;
    routePlan?: unknown[];
  };

  if (!data.transaction || !data.requestId) {
    throw Object.assign(new Error(data.errorMessage || 'Jupiter no armó la transacción'), { status: 400 });
  }

  const quote = quoteFromAmounts(input, output, data.inAmount || lamports, data.outAmount || '0', {
    priceImpactPct: data.priceImpactPct,
    routePlanCount: Array.isArray(data.routePlan) ? data.routePlan.length : 0,
  });

  return {
    ...quote,
    requestId: data.requestId,
    transaction: data.transaction,
    router: data.router,
    taker: takerAddr,
  };
}

export async function executeJupiterSwap(signedTransaction: string, requestId: string): Promise<JupiterExecuteResult> {
  if (!signedTransaction?.trim() || !requestId?.trim()) {
    throw Object.assign(new Error('Falta la transacción firmada o el requestId'), { status: 400 });
  }
  if (getSolanaExecutionMode() === 'demo') {
    throw Object.assign(
      new Error('Estás en Demo/Devnet. Usa simular swap; el execute de Jupiter es Mainnet.'),
      { status: 400 }
    );
  }
  const { key } = await getJupiterApiKey();
  if (!key) {
    throw Object.assign(new Error('Falta la API key de Jupiter Portal'), { status: 401, code: 'JUPITER_KEY' });
  }

  const res = await jupiterPost(EXECUTE_URL, key, {
    signedTransaction,
    requestId,
  });
  const payload = (await res.json().catch(() => ({}))) as {
    status?: string;
    signature?: string;
    error?: string;
    code?: number;
    inputAmountResult?: string;
    outputAmountResult?: string;
    message?: string;
  };

  if (!res.ok) {
    throw Object.assign(new Error(payload.error || payload.message || `Jupiter Execute ${res.status}`), {
      status: res.status >= 400 && res.status < 500 ? res.status : 502,
    });
  }

  const status = payload.status === 'Success' ? 'Success' : 'Failed';
  const signature = payload.signature || '';
  return {
    status,
    signature: signature || undefined,
    error: status === 'Failed' ? payload.error || 'El swap no se confirmó' : undefined,
    code: payload.code,
    inputAmountResult: payload.inputAmountResult,
    outputAmountResult: payload.outputAmountResult,
    solscanUrl: signature ? explorerTxUrl(signature) : undefined,
    cluster: getSolanaCluster(),
    executionMode: getSolanaExecutionMode(),
  };
}

export async function simulateJupiterSwap(
  inputSymbol: string,
  outputSymbol: string,
  amountUi: number
): Promise<JupiterExecuteResult & { quote: JupiterQuoteResult }> {
  if (getSolanaExecutionMode() === 'live' && getSolanaCluster() === 'mainnet-beta') {
    throw Object.assign(
      new Error('En LIVE/Mainnet el swap debe firmarse en Phantom. No se simula.'),
      { status: 400 }
    );
  }
  const quote = await getJupiterQuote(inputSymbol, outputSymbol, amountUi);
  const signature = `SIMULATED-${Date.now()}`;
  return {
    status: 'Success',
    signature,
    simulated: true,
    cluster: getSolanaCluster(),
    executionMode: getSolanaExecutionMode(),
    inputAmountResult: quote.inAmount,
    outputAmountResult: quote.outAmount,
    solscanUrl: undefined,
    quote,
  };
}

export async function getJupiterStatus(): Promise<JupiterStatus> {
  const { key, source } = await getJupiterApiKey();
  const rpc = await pingSolanaRpc();
  const solana = {
    cluster: rpc.cluster,
    executionMode: rpc.executionMode,
    rpcOk: rpc.ok,
    rpcHost: rpc.rpcHost,
    error: rpc.error,
  };
  if (!key) {
    return {
      connected: false,
      hasKey: false,
      keySource: 'none',
      keyHint: null,
      error: 'Crea una API key en portal.jup.ag y pégala en Integraciones',
      solana,
    };
  }

  try {
    const prices = await getJupiterPrices();
    const sol = prices.find((p) => p.symbol === 'SOL' && p.usdPrice != null);
    return {
      connected: Boolean(sol),
      hasKey: true,
      keySource: source,
      keyHint: maskKey(key),
      sample: sol && sol.usdPrice != null ? { symbol: 'SOL', usdPrice: sol.usdPrice } : undefined,
      error: sol ? undefined : 'La API respondió pero sin precio de SOL',
      solana,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Jupiter no responde';
    logger.warn(`[jupiter] ping: ${message}`);
    return {
      connected: false,
      hasKey: true,
      keySource: source,
      keyHint: maskKey(key),
      error: message,
      solana,
    };
  }
}

export async function pingJupiter(): Promise<{ ok: boolean; needsKey: boolean; detail: string; error?: string }> {
  const status = await getJupiterStatus();
  return {
    ok: status.connected,
    needsKey: !status.hasKey,
    detail: status.connected
      ? `SOL $${status.sample?.usdPrice?.toFixed(2) ?? '—'} · ${status.solana?.cluster}/${status.solana?.executionMode}`
      : status.error || 'Sin conexión',
    error: status.connected ? undefined : status.error,
  };
}
