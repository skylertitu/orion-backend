// ============================================================
// MetaTrader Integration - Type Definitions
// ============================================================

/** Tipos de acción que el EA de MetaTrader puede ejecutar */
export type MtAction = 'BUY' | 'SELL' | 'CLOSE' | 'CLOSE_ALL' | 'GET_POSITIONS' | 'GET_SYMBOLS' | 'GET_PRICE' | 'PING';

/** Comando que se envía al Expert Advisor vía ZeroMQ */
export interface MtCommand {
  action: MtAction;
  symbol?: string;     // Ej: "EURUSD", "GBPUSD"
  lots?: number;       // Volumen en lotes (ej: 0.01, 0.1, 1.0)
  sl?: number;         // Stop Loss en precio absoluto (0 = sin SL)
  tp?: number;         // Take Profit en precio absoluto (0 = sin TP)
  ticket?: number;     // Número de ticket (para cerrar posición específica)
  comment?: string;    // Comentario opcional de la orden
  magic?: number;      // Magic por cuenta Orion (no el MAGIC global del EA)
  requestId?: string;  // Correlaciona respuesta; evita cruces tras timeout
}

/** Estado de una posición abierta en MetaTrader */
export interface MtPosition {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  openTime: string;
  comment: string;
  magic: number;
}

/** Respuesta que devuelve el Expert Advisor */
export interface MtResponse {
  status: 'OK' | 'ERROR' | 'PONG';
  message?: string;
  ticket?: number;
  symbol?: string;
  type?: 'BUY' | 'SELL';
  lots?: number;
  openPrice?: number;
  positions?: MtPosition[];
  symbols?: string[];
  bid?: number;
  ask?: number;
  error?: string;
  requestId?: string;
}
