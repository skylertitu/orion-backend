/**
 * Lucy se activa por entorno — no asume SDK externo hasta que lo configures.
 *
 * LUCY_MODE=off     → pending (default)
 * LUCY_MODE=local   → análisis RSI local (chat/señales); auto-trade off salvo LUCY_AUTO_TRADE=true
 * LUCY_MODE=remote  → LUCY_API_URL (+ opcional LUCY_API_KEY); requiere LUCY_ENABLED=true
 */
export type LucyMode = 'off' | 'local' | 'remote';

function resolveMode(): LucyMode {
  const raw = (process.env.LUCY_MODE || '').trim().toLowerCase();
  if (raw === 'local' || raw === 'remote' || raw === 'off') return raw;
  if (process.env.LUCY_ENABLED === 'true' && process.env.LUCY_API_URL?.trim()) return 'remote';
  return 'off';
}

const mode = resolveMode();
const autoTrade = process.env.LUCY_AUTO_TRADE === 'true';

function reasonFor(mode: LucyMode): string {
  if (mode === 'local') {
    return autoTrade
      ? 'Lucy local (RSI) activa con auto-trade.'
      : 'Lucy local (RSI) activa para chat/señales. Auto-trade desactivado (LUCY_AUTO_TRADE).';
  }
  if (mode === 'remote') {
    return 'Lucy remota vía LUCY_API_URL.';
  }
  return 'Lucy apagada. Usa LUCY_MODE=local o LUCY_MODE=remote + LUCY_API_URL.';
}

export const LUCY_INTEGRATION = {
  pending: mode === 'off',
  enabled: mode !== 'off',
  autoTrade: mode !== 'off' && autoTrade,
  mode,
  reason: reasonFor(mode),
} as const;
