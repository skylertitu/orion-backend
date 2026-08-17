// ============================================================
// IBrokerAdapter - Contrato que todos los adaptadores cumplen
// ============================================================
import { BrokerId, BrokerPosition, OrderResult, UnifiedOrder } from './engine.types';

export interface IBrokerAdapter {
  /** Identificador único del broker */
  readonly brokerId: BrokerId;

  /** Nombre legible para mostrar en la UI */
  readonly label: string;

  /** Verifica si la conexión con el broker está activa */
  isConnected(): Promise<boolean>;

  /** Ejecuta una orden (compra, venta, stop, limit, etc.) */
  executeOrder(order: UnifiedOrder): Promise<OrderResult>;

  /** Consulta el precio actual de un símbolo */
  getPrice(symbol: string): Promise<number>;

  /** Retorna las posiciones/órdenes abiertas */
  getPositions(): Promise<BrokerPosition[]>;

  /** Cierra una posición específica por su ticket/ID */
  closePosition(ticket: string | number): Promise<OrderResult>;
}
