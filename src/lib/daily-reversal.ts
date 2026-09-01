/**
 * Daily Candle Reversal — Bearish→Bullish Flip (MyOpenEdge).
 *
 * Pure TypeScript backtest engine. Long only, 1 position (no pyramiding),
 * no stop-loss, no SMA filter.
 *
 * SIGNAL
 *   bearish candle : close < open
 *   bullish candle : close > open
 *   doji (close = open) : neutral — neither bearish nor bullish
 *
 * ENTRY
 *   flat AND candle(D-1) bearish  ->  BUY at the OPEN of day D
 *   (the bearish state of D-1 is known from the start of day D)
 *
 * EXIT (whichever comes first)
 *   candle flip : in-position AND candle(D) bullish -> SELL at the CLOSE of day D
 *   time exit   : position held `maxHoldDays` trading days with no bullish
 *                 candle -> force SELL at the CLOSE of day `maxHoldDays`
 *   if today is bearish while in-position -> no action, just keep counting days
 *
 * Pseudocode:
 *   Open(D):  if flat AND candle(D-1) bearish -> BUY
 *   Close(D): if in-position:
 *               barsInTrade++
 *               if candle(D) bullish      -> SELL (tp)
 *               else if barsInTrade >= N  -> SELL (force exit)
 *
 * Input can be daily bars OR intraday bars — intraday bars are aggregated
 * into daily candles by calendar date first.
 */

export interface DailyInputBar {
  /** "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" */
  datetime: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
}

export interface DailyCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** "bullish" | "bearish" | "doji" */
  kind: "bullish" | "bearish" | "doji";
}

export type DailyReversalOutcome = "flip" | "time_exit";

export interface DailyReversalTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  pnlUsd: number;
  /** return on the allocated notional, in % */
  returnPct: number;
  /** number of trading days the position was held (entry day = 1) */
  holdDays: number;
  outcome: DailyReversalOutcome;
}

export interface DailyReversalStats {
  totalDays: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgHoldDays: number;
  flipExits: number;
  timeExits: number;
  maxDrawdown: number;
  equityCurve: number[];
}

export interface DailyReversalOptions {
  /** max trading days in a trade before the forced exit (default 10) */
  maxHoldDays?: number;
  /** fixed notional allocated per trade in $ (default 10000) */
  allocationUsd?: number;
  /** limit to the most recent N trading days */
  maxDays?: number;
}

export interface DailyReversalResult extends DailyReversalStats {
  symbol: string;
  maxHoldDays: number;
  allocationUsd: number;
  tradesList: DailyReversalTrade[];
  candles: DailyCandle[];
}

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));

/** Aggregate (possibly intraday) bars into daily candles, sorted ascending. */
export function aggregateDailyBars(bars: DailyInputBar[]): DailyCandle[] {
  const map = new Map<string, { open: number; high: number; low: number; close: number; first: string; last: string }>();
  for (const b of bars) {
    const dt = String(b.datetime).replace("T", " ");
    const date = dt.split(" ")[0];
    if (!date) continue;
    const o = num(b.open), h = num(b.high), l = num(b.low), c = num(b.close);
    if (![o, h, l, c].every((v) => isFinite(v))) continue;
    const cur = map.get(date);
    if (!cur) {
      map.set(date, { open: o, high: h, low: l, close: c, first: dt, last: dt });
    } else {
      if (dt < cur.first) { cur.first = dt; cur.open = o; }
      if (dt > cur.last) { cur.last = dt; cur.close = c; }
      if (h > cur.high) cur.high = h;
      if (l < cur.low) cur.low = l;
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      open: v.open,
      high: v.high,
      low: v.low,
      close: v.close,
      kind: v.close > v.open ? "bullish" : v.close < v.open ? "bearish" : "doji",
    }));
}

export function runDailyReversalBacktest(
  symbol: string,
  inputBars: DailyInputBar[],
  options: DailyReversalOptions = {}
): DailyReversalResult {
  const maxHoldDays = Math.max(1, options.maxHoldDays ?? 10);
  const allocationUsd = options.allocationUsd ?? 10_000;

  let candles = aggregateDailyBars(inputBars);
  if (options.maxDays && options.maxDays > 0 && candles.length > options.maxDays + 1) {
    // keep one extra day at the front so the first in-range day can still
    // reference candle(D-1) for its entry condition
    candles = candles.slice(candles.length - (options.maxDays + 1));
  }

  const tradesList: DailyReversalTrade[] = [];
  let pos: { entryDate: string; entryPrice: number; shares: number; daysHeld: number } | null = null;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];

    // Open(D): flat AND candle(D-1) bearish -> BUY at open
    if (!pos && prev.kind === "bearish") {
      const shares = cur.open > 0 ? allocationUsd / cur.open : 0;
      if (shares > 0) pos = { entryDate: cur.date, entryPrice: cur.open, shares, daysHeld: 0 };
    }

    // Close(D)
    if (pos) {
      pos.daysHeld++;
      const flip = cur.kind === "bullish";
      const timeUp = pos.daysHeld >= maxHoldDays;
      if (flip || timeUp) {
        const pnlUsd = pos.shares * (cur.close - pos.entryPrice);
        tradesList.push({
          entryDate: pos.entryDate,
          entryPrice: pos.entryPrice,
          exitDate: cur.date,
          exitPrice: cur.close,
          shares: pos.shares,
          pnlUsd,
          returnPct: (cur.close - pos.entryPrice) / pos.entryPrice * 100,
          holdDays: pos.daysHeld,
          outcome: flip ? "flip" : "time_exit",
        });
        pos = null;
      }
    }
  }

  // still open at the end of the series -> mark-to-market close at last close
  if (pos && candles.length) {
    const last = candles[candles.length - 1];
    const pnlUsd = pos.shares * (last.close - pos.entryPrice);
    tradesList.push({
      entryDate: pos.entryDate,
      entryPrice: pos.entryPrice,
      exitDate: last.date,
      exitPrice: last.close,
      shares: pos.shares,
      pnlUsd,
      returnPct: (last.close - pos.entryPrice) / pos.entryPrice * 100,
      holdDays: pos.daysHeld,
      outcome: pos.daysHeld >= maxHoldDays ? "time_exit" : "flip",
    });
  }

  return {
    symbol,
    maxHoldDays,
    allocationUsd,
    tradesList,
    candles,
    ...computeDailyReversalStats(tradesList, candles.length),
  };
}

export function computeDailyReversalStats(
  trades: DailyReversalTrade[],
  totalDays: number
): DailyReversalStats {
  const wins = trades.filter((t) => t.pnlUsd > 0);
  const losses = trades.filter((t) => t.pnlUsd < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const netPnl = trades.reduce((s, t) => s + t.pnlUsd, 0);

  let equity = 0, peak = 0, maxDrawdown = 0;
  const equityCurve: number[] = [];
  for (const t of trades) {
    equity += t.pnlUsd;
    equityCurve.push(Math.round(equity * 100) / 100);
    if (equity > peak) peak = equity;
    if (peak - equity > maxDrawdown) maxDrawdown = peak - equity;
  }

  return {
    totalDays,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    netPnl,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgHoldDays: trades.length ? trades.reduce((s, t) => s + t.holdDays, 0) / trades.length : 0,
    flipExits: trades.filter((t) => t.outcome === "flip").length,
    timeExits: trades.filter((t) => t.outcome === "time_exit").length,
    maxDrawdown,
    equityCurve,
  };
}
