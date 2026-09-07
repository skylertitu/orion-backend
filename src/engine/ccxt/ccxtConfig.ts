/** CCXT under Binance/Bybit adapters. Off = legacy HTTP only. Default on. */
export function isCcxtEnabled(): boolean {
  return process.env.CCXT_ENABLED !== 'false';
}

export function ccxtStatus(): { enabled: boolean; versionHint: string } {
  return {
    enabled: isCcxtEnabled(),
    versionHint: 'ccxt',
  };
}
