import { isValidBinanceSymbol, normalizeSymbol } from '../config/binance';
import { binancePublicGet } from './binancePublic';

export class BinanceService {
  isValidSymbol(symbol: string): boolean {
    return isValidBinanceSymbol(symbol);
  }

  normalizeSymbol(symbol: string): string {
    return normalizeSymbol(symbol);
  }

  async getPrice(symbol: string): Promise<number> {
    const normalized = normalizeSymbol(symbol);
    const data = await binancePublicGet<{ price: string }>(
      `/ticker/price?symbol=${encodeURIComponent(normalized)}`
    );
    const price = parseFloat(data.price);
    if (!Number.isFinite(price)) {
      throw new Error(`Par no disponible en Binance: ${normalized}`);
    }
    return price;
  }
}

export const binanceService = new BinanceService();
