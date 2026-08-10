/**
 * ORB M15 Pullback — pure TypeScript backtest engine (MyOpenEdge).
 *
 * No external dependencies, no framework, no vendor coupling.
 * Input : 5-minute intraday bars (exchange time) + parameters.
 * Output: per-trade records + aggregate metrics.
 */

export interface IntradayBar {
  /** "YYYY-MM-DD HH:mm:ss" in exchange time */
  datetime: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
}

export interface OhlcCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type OrbMarket = "us" | "idx";
export type OrbSide = "both" | "long" | "short";
export type OrbOutcome = "target" | "stop" | "close" | "no_trigger" | "cancelled";

export interface OrbTrade {
  date: string;
  direction: "long" | "short";
  c1: OhlcCandle;
  c2: OhlcCandle;
  midpoint: number;
  /** stop-order level (C1.high for long, C1.low for short) */
  buyStop: number;
  stopLoss: number;
  target: number;
  entryTime: string | null;
  entryPrice: number | null;
  exitTime: string | null;
  exitPrice: number | null;
  shares: number;
  riskPerShare: number;
  pnlUsd: number;
  rMultiple: number;
  outcome: OrbOutcome;
  /** m15 bars of the session, for charting */
  bars: OhlcCandle[];
}

export interface OrbStats {
  totalDays: number;
  triggeredDays: number;
  cancelledDays: number;
  noTriggerDays: number;
  longTrades: number;
  shortTrades: number;
  longNetPnl: number;
  shortNetPnl: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancyR: number;
  maxDrawdown: number;
  equityCurve: number[];
}

export interface OrbResult extends OrbStats {
  symbol: string;
  market: OrbMarket;
  side: OrbSide;
  riskUsd: number;
  minStopPctOfRange: number;
  /** every evaluated day, including cancelled / no_trigger */
  trades: OrbTrade[];
  /** only the days that produced a filled position */
  triggered: OrbTrade[];
}

export const ORB_SESSIONS: Record<OrbMarket, { start: number; end: number; label: string }> = {
  us: { start: 9 * 60 + 30, end: 16 * 60, label: "09:30–16:00 ET" },
  idx: { start: 9 * 60, end: 15 * 60 + 50, label: "09:00–15:50 WIB" },
};

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));
const pad2 = (n: number) => String(n).padStart(2, "0");

function minutesOf(datetime: string): number {
  const t = datetime.split(" ")[1] ?? datetime.split("T")[1] ?? "00:00:00";
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface Bar5 {
  date: string;
  min: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function normalize(bars: IntradayBar[]): Bar5[] {
  const out: Bar5[] = [];
  for (const b of bars) {
    const dt = String(b.datetime).replace("T", " ");
    const date = dt.split(" ")[0];
    if (!date) continue;
    const o = num(b.open), h = num(b.high), l = num(b.low), c = num(b.close);
    if (![o, h, l, c].every((v) => isFinite(v))) continue;
    const min = minutesOf(dt);
    out.push({ date, min, time: `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`, open: o, high: h, low: l, close: c });
  }
  out.sort((a, b) => (a.date === b.date ? a.min - b.min : a.date.localeCompare(b.date)));
  return out;
}

/** clock-aligned m15 aggregation (:00 / :15 / :30 / :45) */
function toM15(bars: Bar5[]): OhlcCandle[] {
  const groups = new Map<number, Bar5[]>();
  for (const b of bars) {
    const bucket = Math.floor(b.min / 15) * 15;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(b);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, g]) => ({
      time: `${pad2(Math.floor(bucket / 60))}:${pad2(bucket % 60)}`,
      open: g[0].open,
      high: Math.max(...g.map((x) => x.high)),
      low: Math.min(...g.map((x) => x.low)),
      close: g[g.length - 1].close,
    }));
}

function candleOf(bars: Bar5[]): OhlcCandle {
  return {
    time: bars[0].time,
    open: bars[0].open,
    high: Math.max(...bars.map((b) => b.high)),
    low: Math.min(...bars.map((b) => b.low)),
    close: bars[bars.length - 1].close,
  };
}

interface Attempt {
  direction: "long" | "short";
  outcome: OrbOutcome;
  entryIdx: number;
  entryTime: string | null;
  entryPrice: number | null;
  stopLoss: number;
  target: number;
  exitTime: string | null;
  exitPrice: number | null;
}

/**
 * Simulates one directional setup over the session bars.
 * `c2Bars` = the trailing-stop window, `rest` = bars after C2 until session close.
 */
function simulate(
  direction: "long" | "short",
  c1: OhlcCandle,
  midpoint: number,
  range: number,
  c2Bars: Bar5[],
  rest: Bar5[],
  minStopPctOfRange: number
): Attempt {
  const long = direction === "long";
  const level = long ? c1.high : c1.low;
  const target = long ? level + 0.5 * range : level - 0.5 * range;
  const minStop = minStopPctOfRange * range;

  let pullbackDone = false;
  let trailing = long ? Infinity : -Infinity; // running low / running high of C2
  let entryIdx = -1;
  let entryTime: string | null = null;
  let stopLoss = long ? level - minStop : level + minStop;

  const monitored = [...c2Bars, ...rest];

  for (let i = 0; i < monitored.length; i++) {
    const b = monitored[i];
    const inC2 = i < c2Bars.length;

    // cancel — price breaks the C1 midpoint against the setup
    if (long ? b.low < midpoint : b.high > midpoint) {
      return {
        direction, outcome: "cancelled", entryIdx: -1, entryTime: null, entryPrice: null,
        stopLoss, target, exitTime: null, exitPrice: null,
      };
    }

    // pullback back into the C1 range must happen before the stop order is valid
    if (!pullbackDone && (long ? b.low < level : b.high > level)) pullbackDone = true;

    // dynamic trailing stop follows the running extreme of candle 2
    if (inC2) trailing = long ? Math.min(trailing, b.low) : Math.max(trailing, b.high);

    if (pullbackDone && (long ? b.high > level : b.low < level)) {
      const raw = isFinite(trailing) ? trailing : long ? c1.low : c1.high;
      stopLoss = long ? Math.min(raw, level - minStop) : Math.max(raw, level + minStop);
      entryIdx = i;
      entryTime = b.time;
      break;
    }
  }

  if (entryIdx < 0) {
    return {
      direction, outcome: "no_trigger", entryIdx: -1, entryTime: null, entryPrice: null,
      stopLoss, target, exitTime: null, exitPrice: null,
    };
  }

  // manage the position — stop checked before target, flat at session close
  for (let i = entryIdx; i < monitored.length; i++) {
    const b = monitored[i];
    if (long ? b.low <= stopLoss : b.high >= stopLoss) {
      return { direction, outcome: "stop", entryIdx, entryTime, entryPrice: level, stopLoss, target, exitTime: b.time, exitPrice: stopLoss };
    }
    if (long ? b.high >= target : b.low <= target) {
      return { direction, outcome: "target", entryIdx, entryTime, entryPrice: level, stopLoss, target, exitTime: b.time, exitPrice: target };
    }
  }

  const last = monitored[monitored.length - 1];
  return { direction, outcome: "close", entryIdx, entryTime, entryPrice: level, stopLoss, target, exitTime: last.time, exitPrice: last.close };
}

export function runOrbM15Backtest(
  symbol: string,
  bars: IntradayBar[],
  market: OrbMarket = "us",
  riskUsd = 100,
  minStopPctOfRange = 0.1,
  side: OrbSide = "both",
  maxDays = 0
): OrbResult {
  const session = ORB_SESSIONS[market] ?? ORB_SESSIONS.us;
  const all = normalize(bars);

  const byDay = new Map<string, Bar5[]>();
  for (const b of all) {
    if (b.min < session.start || b.min >= session.end) continue;
    if (!byDay.has(b.date)) byDay.set(b.date, []);
    byDay.get(b.date)!.push(b);
  }

  let days = Array.from(byDay.keys()).sort();
  if (maxDays > 0 && days.length > maxDays) days = days.slice(days.length - maxDays);

  const trades: OrbTrade[] = [];

  for (const date of days) {
    const dayBars = byDay.get(date)!;
    const c1Bars = dayBars.filter((b) => b.min >= session.start && b.min < session.start + 15);
    const c2Bars = dayBars.filter((b) => b.min >= session.start + 15 && b.min < session.start + 30);
    const rest = dayBars.filter((b) => b.min >= session.start + 30);
    if (c1Bars.length < 2 || c2Bars.length < 2) continue;

    const c1 = candleOf(c1Bars);
    const c2 = candleOf(c2Bars);
    const range = c1.high - c1.low;
    if (range <= 0) continue;
    const midpoint = (c1.high + c1.low) / 2;
    const m15 = toM15(dayBars);

    const attempts: Attempt[] = [];
    if (side !== "short") attempts.push(simulate("long", c1, midpoint, range, c2Bars, rest, minStopPctOfRange));
    if (side !== "long") attempts.push(simulate("short", c1, midpoint, range, c2Bars, rest, minStopPctOfRange));

    const filled = attempts.filter((a) => a.entryIdx >= 0).sort((a, b) => a.entryIdx - b.entryIdx);
    const chosen =
      filled[0] ??
      attempts.find((a) => a.outcome === "cancelled") ??
      attempts[0];
    if (!chosen) continue;

    const entryPrice = chosen.entryPrice;
    const riskPerShare = entryPrice != null ? Math.abs(entryPrice - chosen.stopLoss) : 0;
    const shares = riskPerShare > 0 ? riskUsd / riskPerShare : 0;
    const pnlUsd =
      entryPrice != null && chosen.exitPrice != null
        ? shares * (chosen.direction === "long" ? chosen.exitPrice - entryPrice : entryPrice - chosen.exitPrice)
        : 0;

    trades.push({
      date,
      direction: chosen.direction,
      c1,
      c2,
      midpoint,
      buyStop: chosen.direction === "long" ? c1.high : c1.low,
      stopLoss: chosen.stopLoss,
      target: chosen.target,
      entryTime: chosen.entryTime,
      entryPrice,
      exitTime: chosen.exitTime,
      exitPrice: chosen.exitPrice,
      shares,
      riskPerShare,
      pnlUsd,
      rMultiple: riskUsd > 0 ? pnlUsd / riskUsd : 0,
      outcome: chosen.outcome,
      bars: m15,
    });
  }

  return {
    symbol,
    market,
    side,
    riskUsd,
    minStopPctOfRange,
    trades,
    triggered: trades.filter((t) => t.entryPrice != null),
    ...computeOrbStats(trades),
  };
}

export function computeOrbStats(trades: OrbTrade[]): OrbStats {
  const triggered = trades.filter((t) => t.entryPrice != null);
  const wins = triggered.filter((t) => t.pnlUsd > 0);
  const losses = triggered.filter((t) => t.pnlUsd < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const netPnl = triggered.reduce((s, t) => s + t.pnlUsd, 0);

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve: number[] = [];
  for (const t of triggered) {
    equity += t.pnlUsd;
    equityCurve.push(Math.round(equity * 100) / 100);
    if (equity > peak) peak = equity;
    if (peak - equity > maxDrawdown) maxDrawdown = peak - equity;
  }

  const longs = triggered.filter((t) => t.direction === "long");
  const shorts = triggered.filter((t) => t.direction === "short");

  return {
    totalDays: trades.length,
    triggeredDays: triggered.length,
    cancelledDays: trades.filter((t) => t.outcome === "cancelled").length,
    noTriggerDays: trades.filter((t) => t.outcome === "no_trigger").length,
    longTrades: longs.length,
    shortTrades: shorts.length,
    longNetPnl: longs.reduce((s, t) => s + t.pnlUsd, 0),
    shortNetPnl: shorts.reduce((s, t) => s + t.pnlUsd, 0),
    wins: wins.length,
    losses: losses.length,
    winRate: triggered.length ? (wins.length / triggered.length) * 100 : 0,
    netPnl,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    expectancyR: triggered.length ? triggered.reduce((s, t) => s + t.rMultiple, 0) / triggered.length : 0,
    maxDrawdown,
    equityCurve,
  };
}

/** splits the trade list into `parts` chronological segments with their own metrics */
export function segmentOrbStats(trades: OrbTrade[], parts = 3): { label: string; from: string; to: string; stats: OrbStats }[] {
  if (trades.length === 0) return [];
  const size = Math.ceil(trades.length / parts);
  const out: { label: string; from: string; to: string; stats: OrbStats }[] = [];
  for (let i = 0; i < parts; i++) {
    const slice = trades.slice(i * size, (i + 1) * size);
    if (slice.length === 0) continue;
    out.push({
      label: `segment ${i + 1}`,
      from: slice[0].date,
      to: slice[slice.length - 1].date,
      stats: computeOrbStats(slice),
    });
  }
  return out;
}
