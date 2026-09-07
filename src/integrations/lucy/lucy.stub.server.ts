/**
 * Stub mínimo del contrato Lucy remoto.
 * Uso: pnpm exec tsx src/integrations/lucy/lucy.stub.server.ts
 * Luego en .env: LUCY_MODE=remote  LUCY_API_URL=http://127.0.0.1:5000
 */
import http from 'http';
import { calcRSI } from '../../engine/StrategyEngine';

const PORT = Number(process.env.LUCY_STUB_PORT || 5000);

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

function analyzeFromRows(symbol: string, rows: number[][]) {
  const closes = rows.map((r) => Number(r[4] || 0)).filter((n) => n > 0);
  const rsiArr = closes.length >= 15 ? calcRSI(closes, 14) : [];
  const rsi = rsiArr.length ? rsiArr[rsiArr.length - 1] : 50;
  const price = closes[closes.length - 1] || 0;
  const action = rsi <= 30 ? 'buy' : rsi >= 70 ? 'sell' : 'hold';
  const trend = action === 'buy' ? 'bullish' : action === 'sell' ? 'bearish' : 'neutral';
  return {
    success: true,
    signals:
      action === 'hold'
        ? []
        : [
            {
              symbol,
              action,
              confidence: 0.7,
              timestamp: new Date().toISOString(),
              indicators: { rsi, price, source: 'lucy-stub' },
            },
          ],
    patterns: [action === 'hold' ? 'rsi_neutral' : action === 'buy' ? 'rsi_oversold' : 'rsi_overbought'],
    support: closes.length ? Math.min(...closes.slice(-20)) : 0,
    resistance: closes.length ? Math.max(...closes.slice(-20)) : 0,
    trend,
  };
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  if (req.method === 'GET' && url.startsWith('/health')) {
    return json(res, 200, { ok: true, stub: true });
  }

  if (req.method === 'GET' && url.startsWith('/signals/')) {
    const symbol = decodeURIComponent(url.replace('/signals/', '').split('?')[0] || 'BTCUSDT');
    return json(res, 200, analyzeFromRows(symbol, []));
  }

  if (req.method === 'POST' && url.startsWith('/analyze')) {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const symbol = String(body.symbol || 'BTCUSDT');
      const data = Array.isArray(body.data) ? body.data : [];
      return json(res, 200, analyzeFromRows(symbol, data));
    } catch (err: any) {
      return json(res, 400, { success: false, error: err?.message || 'JSON inválido' });
    }
  }

  json(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[lucy-stub] http://127.0.0.1:${PORT}  (health/analyze/signals)`);
});
