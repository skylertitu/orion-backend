/** PENDIENTE: contrato del futuro SDK/API Lucy. No asumir que el servicio existe. */
export interface LucyConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface LucyChartRequest {
  symbol: string;
  interval: string;
  data: number[][];
  indicators?: Record<string, unknown>;
  script?: string;
}

export interface LucySignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold' | 'exit' | 'close';
  confidence: number;
  timestamp: string;
  indicators: Record<string, any>;
}

export interface LucyAnalysisResult {
  success: boolean;
  signals: LucySignal[];
  patterns: string[];
  support: number;
  resistance: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}
