export interface StrategyState {
  strategyId: number;
  inPosition: boolean;
  side: 'buy' | 'sell';
  entryPrice: number;
  entryTime: number;
  ticket?: string | number;
  tradeId?: number;
  quantity?: number;
  pairSymbol?: string;
  pairSide?: 'buy' | 'sell';
  pairEntryPrice?: number;
  pairTicket?: string | number;
  pairTradeId?: number;
  pairQuantity?: number;
}

export interface WorkerStatus {
  running: boolean;
  uptime: number;
  cycleCount: number;
  lastCycleAt: string | null;
  activeStrategies: number;
  openPositions: number;
  wsConnected: boolean;
  errors: string[];
  strategyStates: {
    strategyId: number;
    name: string;
    inPosition: boolean;
    entryPrice: number;
    entryTime: string | null;
  }[];
}
