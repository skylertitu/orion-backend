const REST_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
];

export async function binancePublicGet<T = unknown>(pathAndQuery: string): Promise<T> {
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  let lastError = 'Binance no disponible';

  for (const host of REST_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3${path}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        return (await res.json()) as T;
      }
      lastError = `${host} → ${res.status}`;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError);
}
