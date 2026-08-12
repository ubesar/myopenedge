/**
 * Realistic execution modeling for the backtester.
 * Slippage is applied adversely on both entry and exit, commissions are
 * subtracted from the trade PnL, so gross vs net can be compared side by side.
 */

export type SlippageUnit = "tick" | "bps";

export interface CostSettings {
  /** slippage amount, expressed in `slippageUnit` */
  slippage: number;
  slippageUnit: SlippageUnit;
  /** tick size of the instrument (only used when slippageUnit === "tick") */
  tickSize: number;
  /** flat fee charged once per round-turn trade */
  commissionPerTrade: number;
  /** fee charged per share/contract (round-turn) */
  commissionPerShare: number;
}

export const DEFAULT_COSTS: CostSettings = {
  slippage: 0,
  slippageUnit: "tick",
  tickSize: 0.01,
  commissionPerTrade: 0,
  commissionPerShare: 0,
};

export interface CostableTrade {
  direction: "bullish" | "bearish";
  entry: number;
  stop: number;
  target: number;
  qty: number;
  outcome: "win" | "loss";
  exitPrice?: number;
}

export interface CostedFields {
  /** exit price used for the pnl computation */
  resolvedExit: number;
  entryFilled: number;
  exitFilled: number;
  pnlGross: number;
  pnlNet: number;
  costTotal: number;
  slippageCost: number;
  commissionCost: number;
}

export const hasCosts = (c: CostSettings) =>
  c.slippage > 0 || c.commissionPerTrade > 0 || c.commissionPerShare > 0;

export function slippagePrice(price: number, c: CostSettings): number {
  if (!c.slippage || c.slippage <= 0) return 0;
  return c.slippageUnit === "tick"
    ? c.slippage * (c.tickSize || 0.01)
    : (price * c.slippage) / 10000;
}

export function applyCosts<T extends CostableTrade>(trade: T, c: CostSettings): T & CostedFields {
  const sign = trade.direction === "bullish" ? 1 : -1;
  const resolvedExit = trade.exitPrice ?? (trade.outcome === "win" ? trade.target : trade.stop);

  const slipIn = slippagePrice(trade.entry, c);
  const slipOut = slippagePrice(resolvedExit, c);

  // adverse fill on both sides
  const entryFilled = trade.entry + sign * slipIn;
  const exitFilled = resolvedExit - sign * slipOut;

  const pnlGross = trade.qty * (resolvedExit - trade.entry) * sign;
  const pnlAfterSlip = trade.qty * (exitFilled - entryFilled) * sign;
  const slippageCost = pnlGross - pnlAfterSlip;
  const commissionCost = c.commissionPerTrade + c.commissionPerShare * trade.qty;

  return {
    ...trade,
    resolvedExit,
    entryFilled,
    exitFilled,
    pnlGross,
    pnlNet: pnlAfterSlip - commissionCost,
    slippageCost,
    commissionCost,
    costTotal: slippageCost + commissionCost,
  };
}

export function applyCostsAll<T extends CostableTrade>(trades: T[], c: CostSettings): (T & CostedFields)[] {
  return trades.map((t) => applyCosts(t, c));
}
