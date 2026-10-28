import { BrokerEnvironment } from '../types';

export type ExecutionMode = 'demo' | 'live';

export function isPaperTradingForced(): boolean {
  return (
    process.env.PAPER_TRADING === 'true' ||
    process.env.FORCE_PAPER_TRADING === 'true' ||
    process.env.PAPER_MODE === 'true'
  );
}

export function executionModeOf(
  meta?: Record<string, unknown> | null,
  environment?: BrokerEnvironment | string
): ExecutionMode {
  if (isPaperTradingForced()) return 'demo';
  if (meta?.executionMode === 'live') return 'live';
  if (meta?.executionMode === 'demo') return 'demo';
  if (environment === 'testnet') return 'demo';
  return 'demo';
}

export function withExecutionMode(
  meta: Record<string, unknown> | null | undefined,
  mode: ExecutionMode
): Record<string, unknown> {
  return { ...(meta || {}), executionMode: mode };
}
