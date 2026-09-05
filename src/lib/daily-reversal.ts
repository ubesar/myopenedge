/**
 * Daily Candle Reversal — DeepBuyCandle port (MyOpenEdge).
 *
 * Faithful TypeScript port of the NinjaTrader "DeepBuyCandle" strategy.
 *
 * CANDLE DEFINITION (configurable)
 *   closeVsOpen      : body = close(D) - open(D)
 *   closeVsPrevClose : body = close(D) - close(D-1)
 *   |body| in ticks < minBodyTicks  -> neutral / doji (no signal)
 *   body > 0 -> bullish, body < 0 -> bearish
 *
 * STREAKS
 *   consecutive bearish / bullish counters. A neutral candle breaks BOTH
 *   streaks. A candle of the opposite direction resets the other streak.
 *
 * SIGNALS (buyOnBearish = true, default)
 *   flat  AND bearish streak >= bearishDaysRequired -> logical long = true
 *             (the buy streak counter is reset to 0 after firing)
 *   long  AND bullish streak >= bullishDaysRequired -> logical long = false
 *             (the sell streak counter is reset to 0 after firing)
 *   buyOnBearish = false flips which streak drives buy vs sell.
 *
 * EXECUTION (Calculate.OnBarClose)
 *   Signals are evaluated at the CLOSE of day D, orders fill at the OPEN of
 *   day D+1 — both for entries and exits. Long only, 1 position, no
 *   pyramiding, no stop-loss, no target.
 *
 * The prop-firm 04:00-06:00 WITA forced-flat window is a live-execution
 * concern only (the NinjaScript skips it outside State.Realtime), so it is
 * intentionally not modelled in this backtest engine.
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

export type CandleKind = "bullish" | "bearish" | "neutral";
export type CandleDefinition = "closeVsOpen" | "closeVsPrevClose";

export interface DailyCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** signed body according to the active candle definition */
  body: number;
  bodyTicks: number;
  kind: CandleKind;
}

export type DailyReversalOutcome = "signal_exit" | "open_at_end";

export interface DailyReversalTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  /** contracts (contracts sizing) or shares (notional sizing) */
  shares: number;
  pnlUsd: number;
  /** return on the entry price, in % */
  returnPct: number;
  /** number of trading days the position was held (entry day = 1) */
  holdDays: number;
  outcome: DailyReversalOutcome;
  /** streak length that triggered the entry */
  entryStreak: number;
  /** streak length that triggered the exit (0 when still open at the end) */
  exitStreak: number;
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
  signalExits: number;
  openAtEnd: number;
  maxDrawdown: number;
  equityCurve: number[];
}

export interface DailyReversalOptions {
  /** how bullish/bearish is measured (default "closeVsOpen") */
  candleMode?: CandleDefinition;
  /** bodies smaller than this (in ticks) are neutral; 0 = disabled */
  minBodyTicks?: number;
  /** instrument tick size used for the minBodyTicks filter (default 0.01) */
  tickSize?: number;
  /** true = bearish streak buys (default); false = flips the logic */
  buyOnBearish?: boolean;
  /** consecutive bearish candles required (default 1) */
  bearishDaysRequired?: number;
  /** consecutive bullish candles required (default 1) */
  bullishDaysRequired?: number;
  /** "notional" = allocationUsd / price, "contracts" = fixed contracts */
  sizing?: "notional" | "contracts";
  /** fixed notional allocated per trade in $ (notional sizing, default 10000) */
  allocationUsd?: number;
  /** number of contracts (contracts sizing, default 1) */
  contracts?: number;
  /** $ value of a 1.00 price move per contract (contracts sizing, default 1) */
  pointValue?: number;
  /** limit to the most recent N trading days */
  maxDays?: number;
}

export interface DailyReversalResult extends DailyReversalStats {
  symbol: string;
  candleMode: CandleDefinition;
  buyOnBearish: boolean;
  bearishDaysRequired: number;
  bullishDaysRequired: number;
  minBodyTicks: number;
  sizing: "notional" | "contracts";
  allocationUsd: number;
  contracts: number;
  tradesList: DailyReversalTrade[];
  candles: DailyCandle[];
}

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));

interface RawDaily { date: string; open: number; high: number; low: number; close: number }

/** Aggregate (possibly intraday) bars into daily OHLC, sorted ascending. */
function aggregateRaw(bars: DailyInputBar[]): RawDaily[] {
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
    .map(([date, v]) => ({ date, open: v.open, high: v.high, low: v.low, close: v.close }));
}

/**
 * Aggregate bars into classified daily candles.
 * `closeVsPrevClose` compares against the previous day's close; the first
 * candle of the series is therefore always neutral in that mode.
 */
export function aggregateDailyBars(
  bars: DailyInputBar[],
  candleMode: CandleDefinition = "closeVsOpen",
  minBodyTicks = 0,
  tickSize = 0.01,
): DailyCandle[] {
  const raw = aggregateRaw(bars);
  const ts = tickSize > 0 ? tickSize : 0.01;
  return raw.map((d, i) => {
    const ref = candleMode === "closeVsPrevClose" ? (i > 0 ? raw[i - 1].close : NaN) : d.open;
    const body = isFinite(ref) ? d.close - ref : 0;
    const bodyTicks = Math.abs(body) / ts;
    const valid = body !== 0 && bodyTicks >= minBodyTicks;
    return {
      ...d,
      body,
      bodyTicks,
      kind: (valid ? (body > 0 ? "bullish" : "bearish") : "neutral") as CandleKind,
    };
  });
}

export function runDailyReversalBacktest(
  symbol: string,
  inputBars: DailyInputBar[],
  options: DailyReversalOptions = {}
): DailyReversalResult {
  const candleMode = options.candleMode ?? "closeVsOpen";
  const minBodyTicks = Math.max(0, options.minBodyTicks ?? 0);
  const tickSize = options.tickSize && options.tickSize > 0 ? options.tickSize : 0.01;
  const buyOnBearish = options.buyOnBearish ?? true;
  const bearishDaysRequired = Math.max(1, options.bearishDaysRequired ?? 1);
  const bullishDaysRequired = Math.max(1, options.bullishDaysRequired ?? 1);
  const sizing = options.sizing ?? "notional";
  const allocationUsd = options.allocationUsd ?? 10_000;
  const contracts = Math.max(1, options.contracts ?? 1);
  const pointValue = options.pointValue && options.pointValue > 0 ? options.pointValue : 1;

  let candles = aggregateDailyBars(inputBars, candleMode, minBodyTicks, tickSize);
  if (options.maxDays && options.maxDays > 0 && candles.length > options.maxDays) {
    candles = candles.slice(candles.length - options.maxDays);
  }

  const tradesList: DailyReversalTrade[] = [];
  let logicalLong = false;
  let bearStreak = 0;
  let bullStreak = 0;
  /** pending order to be filled at the next bar open */
  let pending: { side: "buy" | "sell"; streak: number } | null = null;
  let pos: { entryDate: string; entryPrice: number; shares: number; entryIndex: number; entryStreak: number } | null = null;

  const sizeFor = (price: number) =>
    sizing === "contracts" ? contracts : price > 0 ? allocationUsd / price : 0;

  for (let i = 0; i < candles.length; i++) {
    const cur = candles[i];

    // ---- fill pending order at this bar's OPEN ----
    if (pending) {
      if (pending.side === "buy" && !pos) {
        const shares = sizeFor(cur.open);
        if (shares > 0) {
          pos = { entryDate: cur.date, entryPrice: cur.open, shares, entryIndex: i, entryStreak: pending.streak };
        }
      } else if (pending.side === "sell" && pos) {
        const mult = sizing === "contracts" ? pointValue : 1;
        tradesList.push({
          entryDate: pos.entryDate,
          entryPrice: pos.entryPrice,
          exitDate: cur.date,
          exitPrice: cur.open,
          shares: pos.shares,
          pnlUsd: pos.shares * (cur.open - pos.entryPrice) * mult,
          returnPct: ((cur.open - pos.entryPrice) / pos.entryPrice) * 100,
          holdDays: i - pos.entryIndex,
          outcome: "signal_exit",
          entryStreak: pos.entryStreak,
          exitStreak: pending.streak,
        });
        pos = null;
      }
      pending = null;
    }

    // ---- evaluate the candle at its CLOSE ----
    if (cur.kind === "bearish") { bearStreak++; bullStreak = 0; }
    else if (cur.kind === "bullish") { bullStreak++; bearStreak = 0; }
    else { bearStreak = 0; bullStreak = 0; }

    const buyCount = buyOnBearish ? bearStreak : bullStreak;
    const buyRequired = buyOnBearish ? bearishDaysRequired : bullishDaysRequired;
    const sellCount = buyOnBearish ? bullStreak : bearStreak;
    const sellRequired = buyOnBearish ? bullishDaysRequired : bearishDaysRequired;

    if (!logicalLong) {
      if (buyCount >= buyRequired) {
        logicalLong = true;
        pending = { side: "buy", streak: buyCount };
        if (buyOnBearish) bearStreak = 0; else bullStreak = 0;
      }
    } else {
      if (sellCount >= sellRequired) {
        logicalLong = false;
        pending = { side: "sell", streak: sellCount };
        if (buyOnBearish) bullStreak = 0; else bearStreak = 0;
      }
    }
  }

  // still open at the end of the series -> mark-to-market at the last close
  if (pos && candles.length) {
    const last = candles[candles.length - 1];
    const mult = sizing === "contracts" ? pointValue : 1;
    tradesList.push({
      entryDate: pos.entryDate,
      entryPrice: pos.entryPrice,
      exitDate: last.date,
      exitPrice: last.close,
      shares: pos.shares,
      pnlUsd: pos.shares * (last.close - pos.entryPrice) * mult,
      returnPct: ((last.close - pos.entryPrice) / pos.entryPrice) * 100,
      holdDays: candles.length - 1 - pos.entryIndex + 1,
      outcome: "open_at_end",
      entryStreak: pos.entryStreak,
      exitStreak: 0,
    });
  }

  return {
    symbol,
    candleMode,
    buyOnBearish,
    bearishDaysRequired,
    bullishDaysRequired,
    minBodyTicks,
    sizing,
    allocationUsd,
    contracts,
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
    signalExits: trades.filter((t) => t.outcome === "signal_exit").length,
    openAtEnd: trades.filter((t) => t.outcome === "open_at_end").length,
    maxDrawdown,
    equityCurve,
  };
}
