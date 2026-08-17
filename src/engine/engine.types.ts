// ============================================================
// Trading Engine - Tipos Unificados
// Usado por todos los adaptadores de broker
// ============================================================

/** Brokers soportados por la plataforma */
export type BrokerId = 'binance' | 'mt5' | 'bybit' | 'okx' | 'oanda';

/** Dirección de la orden */
export type OrderSide = 'buy' | 'sell';

/**
 * Orden unificada que el frontend envía al backend.
 * El motor decide qué adaptador usar según `broker`.
 */
export interface UnifiedOrder {
  broker: BrokerId;
  symbol: string;
  side: OrderSide;
  quantity?: number;
  lot?: number;
  sl?: number;
  tp?: number;
  comment?: string;
  /** Usuario dueño de la cuenta (requerido para ejecución por cuenta) */
  userId?: number;
  /** Cuenta conectada específica; si no se indica, usa la principal del broker */
  brokerAccountId?: number;
}

/**
 * Resultado estándar de una orden ejecutada.
 * Todos los adaptadores devuelven este formato.
 */
export interface OrderResult {
  success: boolean;
  broker: BrokerId;
  ticket?: string | number;
  symbol: string;
  side: OrderSide;
  quantity?: number;
  lot?: number;
  executedPrice?: number;
  error?: string;
  brokerAccountId?: number;
  raw?: any;
}

/**
 * Posición abierta en un broker.
 * Formato normalizado independiente del broker.
 */
export interface BrokerPosition {
  broker: BrokerId;
  ticket: string | number;
  symbol: string;
  side: OrderSide;
  quantity?: number;
  lot?: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  sl?: number;
  tp?: number;
  openTime?: string;
  comment?: string;
  brokerAccountId?: number;
}

/**
 * Estado de conexión de un broker registrado
 */
export interface BrokerStatus {
  id: BrokerId;
  label: string;
  connected: boolean;
  enabled: boolean;
  message?: string;
  error?: string;
}
