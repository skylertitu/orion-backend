import { LucyConfig, LucyChartRequest, LucyAnalysisResult } from './lucy.types';
import { LUCY_INTEGRATION } from './lucy.pending';
import { logger } from '../../utils/logger';

const DEFAULT_CONFIG: LucyConfig = {
  apiUrl: process.env.LUCY_API_URL || 'http://localhost:5000',
  apiKey: process.env.LUCY_API_KEY || '',
  timeout: 30000,
};

class LucyService {
  private config: LucyConfig;

  constructor(config: Partial<LucyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  async analyzeChart(data: LucyChartRequest): Promise<LucyAnalysisResult> {
    if (LUCY_INTEGRATION.pending) {
      throw new Error(LUCY_INTEGRATION.reason);
    }
    try {
      const res = await fetch(`${this.config.apiUrl}/analyze`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!res.ok) {
        const err = `Lucy API error: ${res.status} ${res.statusText}`;
        logger.error(`[lucy] Envío /analyze fallido: ${err}`);
        throw new Error(err);
      }

      return res.json() as Promise<LucyAnalysisResult>;
    } catch (err: any) {
      if (!String(err.message || '').startsWith('Lucy API error')) {
        logger.error(`[lucy] Envío /analyze fallido: ${err.message || err}`);
      }
      throw err;
    }
  }

  async getSignals(symbol: string): Promise<LucyAnalysisResult> {
    if (LUCY_INTEGRATION.pending) {
      throw new Error(LUCY_INTEGRATION.reason);
    }
    try {
      const res = await fetch(
        `${this.config.apiUrl}/signals/${symbol}`,
        { headers: this.headers }
      );

      if (!res.ok) {
        const err = `Lucy API error: ${res.status} ${res.statusText}`;
        logger.error(`[lucy] Envío /signals/${symbol} fallido: ${err}`);
        throw new Error(err);
      }

      return res.json() as Promise<LucyAnalysisResult>;
    } catch (err: any) {
      if (!String(err.message || '').startsWith('Lucy API error')) {
        logger.error(`[lucy] Envío /signals/${symbol} fallido: ${err.message || err}`);
      }
      throw err;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (LUCY_INTEGRATION.pending) return false;
    try {
      const res = await fetch(`${this.config.apiUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const lucyService = new LucyService();
export { DEFAULT_CONFIG };
