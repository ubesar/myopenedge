export type TradeSide = 'LONG' | 'SHORT';
export type TradeSession = 'ASIA' | 'LONDON' | 'NY' | 'OVERLAP';
export type TradeGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type TradeSource = 'CSV' | 'IMAGE' | 'MANUAL';

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  openTime: string;
  closeTime: string;
  pnlGross: number;
  fees: number;
  pnlNet: number;
  rMultiple?: number;
  session: TradeSession;
  setupTags: string[];
  grade?: TradeGrade;
  notes?: string;
  source: TradeSource;
  confidenceScore?: number;
  createdAt: string;
}

export interface DashboardStats {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  avgRMultiple: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  pnl: number;
}

export interface PnlByDay {
  day: string;
  pnl: number;
  trades: number;
}

export interface BreakdownItem {
  name: string;
  pnl: number;
  trades: number;
  winRate: number;
}
