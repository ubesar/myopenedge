import { parse } from "date-fns";
import type { CandleBar } from "./m15-aggregation";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type FormedFirst = "HIGH" | "LOW";
export type BreakoutSide = "HIGH" | "LOW" | "NONE";

export interface NYOrbDay {
  date: string;
  orbHigh: number;
  orbLow: number;
  orbSize: number;
  formedFirst: FormedFirst;
  firstBreakout: BreakoutSide;
  breakoutTime?: string;
  extensionHit: boolean;
  bars: CandleBar[];
  trade?: NYOrbTrade;
}

export interface NYOrbTrade {
  date: string;
  side: "long" | "short";
  c1Time: string;
  c2Time: string;
  entry: number;
  stop: number;
  target: number;
  risk: number;
  outcome: "win" | "loss" | "open" | "cancelled" | "no-trigger";
  rMultiple: number;
  pnlUsd: number;
  exitTime?: string;
}

export const FIXED_RISK_USD = 100;

export interface FormedFirstStats {
  formedFirst: FormedFirst;
  n: number;
  breakHigh: number;
  breakLow: number;
  breakHighPct: number;
  breakLowPct: number;
  noBreakout: number;
}

export interface NYOrbResult {
  symbol: string;
  totalDays: number;
  highFirstStats: FormedFirstStats;
  lowFirstStats: FormedFirstStats;
  extensionHitPct: number;
  trades: NYOrbTrade[];
  tradeStats: {
    total: number;
    wins: number;
    losses: number;
    open: number;
    winRate: number;
    expectancyR: number;
    totalPnlUsd: number;
  };
  today?: NYOrbDay;
  days: NYOrbDay[];
}

const SESSION_START = 9 * 60 + 30;
const ORB_END = 9 * 60 + 45;
const SESSION_END = 16 * 60;

const parseDT = (dt: string) => parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

interface Bar { d: Date; open: number; high: number; low: number; close: number }

/** Aggregate ordered m5 session bars into m15 candles anchored at 09:30. */
function toM15(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  let group: Bar[] = [];
  for (const b of bars) {
    const slot = Math.floor((minutesOf(b.d) - SESSION_START) / 15);
    const firstSlot = group.length
      ? Math.floor((minutesOf(group[0].d) - SESSION_START) / 15)
      : slot;
    if (group.length && slot !== firstSlot) {
      out.push(mergeBars(group));
      group = [];
    }
    group.push(b);
  }
  if (group.length) out.push(mergeBars(group));
  return out;
}

function mergeBars(g: Bar[]): Bar {
  return {
    d: g[0].d,
    open: g[0].open,
    high: Math.max(...g.map((b) => b.high)),
    low: Math.min(...g.map((b) => b.low)),
    close: g[g.length - 1].close,
  };
}

/**
 * NY Open ORB m15 probabilities (opening range built from the 09:30 / 09:35 / 09:40 m5 candles).
 *
 * formedFirst is resolved by wick sequence: the m5 candle that printed the absolute
 * high/low first wins; when both extremes sit in the same candle the candle direction
 * decides (bullish candle → low printed first, bearish candle → high printed first).
 *
 * Entry engine: C1 = first m15 momentum candle of the session, C2 = pullback candle.
 * Stop order at the C1 extreme, stop loss trails with C2 until triggered, order is
 * cancelled if C2 breaks the opposite side of C1, target = 1 × extension of C1 range.
 */
export function analyzeNYOrbM15(
  bars: BarData[],
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
  bodyRatio: number = 0.6,
  symbol: string = "NQ",
): NYOrbResult {
  const byDate = new Map<string, BarData[]>();
  for (const b of bars) {
    const date = b.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(b);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter((d) => weekdays.includes(new Date(d + "T12:00:00").getDay()));

  const days: NYOrbDay[] = [];

  for (const date of dates) {
    const session: Bar[] = byDate
      .get(date)!
      .map((b) => ({
        d: parseDT(b.datetime),
        open: parseFloat(b.open),
        high: parseFloat(b.high),
        low: parseFloat(b.low),
        close: parseFloat(b.close),
      }))
      .filter((b) => {
        const m = minutesOf(b.d);
        return m >= SESSION_START && m < SESSION_END;
      })
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    if (session.length === 0) continue;

    const orbBars = session.filter((b) => minutesOf(b.d) < ORB_END);
    const postBars = session.filter((b) => minutesOf(b.d) >= ORB_END);
    if (orbBars.length === 0) continue;

    const orbHigh = Math.max(...orbBars.map((b) => b.high));
    const orbLow = Math.min(...orbBars.map((b) => b.low));
    const orbSize = orbHigh - orbLow;
    if (orbSize <= 0) continue;

    const hiIdx = orbBars.findIndex((b) => b.high === orbHigh);
    const loIdx = orbBars.findIndex((b) => b.low === orbLow);
    let formedFirst: FormedFirst;
    if (hiIdx !== loIdx) {
      formedFirst = hiIdx < loIdx ? "HIGH" : "LOW";
    } else {
      const b = orbBars[hiIdx];
      formedFirst = b.close >= b.open ? "LOW" : "HIGH";
    }

    // first breakout by wick after 09:45
    let firstBreakout: BreakoutSide = "NONE";
    let breakoutTime: string | undefined;
    let extensionHit = false;
    for (const b of postBars) {
      const up = b.high > orbHigh;
      const down = b.low < orbLow;
      if (!up && !down) continue;
      if (up && down) firstBreakout = b.close >= b.open ? "LOW" : "HIGH";
      else firstBreakout = up ? "HIGH" : "LOW";
      breakoutTime = hhmm(b.d);
      break;
    }
    if (firstBreakout !== "NONE") {
      const target =
        firstBreakout === "HIGH" ? orbHigh + orbSize : orbLow - orbSize;
      extensionHit = postBars.some((b) =>
        firstBreakout === "HIGH" ? b.high >= target : b.low <= target,
      );
    }

    const day: NYOrbDay = {
      date,
      orbHigh,
      orbLow,
      orbSize,
      formedFirst,
      firstBreakout,
      breakoutTime,
      extensionHit,
      bars: session.map((b) => ({
        time: hhmm(b.d),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    };

    // ORB = m15 pertama (09:30–09:45). Entry = break high/low ORB,
    // SL di 50% (mid) ORB candle, target 1 × extension ORB.
    const postOrbM15 = toM15(session).filter((b) => minutesOf(b.d) >= ORB_END);
    day.trade = findTrade(date, postOrbM15, orbHigh, orbLow, orbSize);
    days.push(day);
  }

  const statsFor = (ff: FormedFirst): FormedFirstStats => {
    const rows = days.filter((d) => d.formedFirst === ff);
    const resolved = rows.filter((d) => d.firstBreakout !== "NONE");
    const breakHigh = resolved.filter((d) => d.firstBreakout === "HIGH").length;
    const breakLow = resolved.filter((d) => d.firstBreakout === "LOW").length;
    const n = resolved.length;
    return {
      formedFirst: ff,
      n,
      breakHigh,
      breakLow,
      breakHighPct: n ? (breakHigh / n) * 100 : 0,
      breakLowPct: n ? (breakLow / n) * 100 : 0,
      noBreakout: rows.length - n,
    };
  };

  const trades = days
    .map((d) => d.trade)
    .filter((t): t is NYOrbTrade => !!t && (t.outcome === "win" || t.outcome === "loss" || t.outcome === "open"));

  const wins = trades.filter((t) => t.outcome === "win").length;
  const losses = trades.filter((t) => t.outcome === "loss").length;
  const open = trades.filter((t) => t.outcome === "open").length;
  const sumR = trades.reduce((a, t) => a + t.rMultiple, 0);

  const withBreakout = days.filter((d) => d.firstBreakout !== "NONE");

  return {
    symbol,
    totalDays: days.length,
    highFirstStats: statsFor("HIGH"),
    lowFirstStats: statsFor("LOW"),
    extensionHitPct: withBreakout.length
      ? (withBreakout.filter((d) => d.extensionHit).length / withBreakout.length) * 100
      : 0,
    trades,
    tradeStats: {
      total: trades.length,
      wins,
      losses,
      open,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
      expectancyR: trades.length ? sumR / trades.length : 0,
      totalPnlUsd: sumR * FIXED_RISK_USD,
    },
    today: days[days.length - 1],
    days,
  };
}

/** C1 momentum candle → C2 pullback → stop order at C1 extreme, target 1 × extension. */
function findTrade(
  date: string,
  m15: Bar[],
  bodyRatio: number,
  orbHigh: number,
  orbLow: number,
  orbSize: number,
): NYOrbTrade | undefined {
  for (let i = 0; i < m15.length - 1; i++) {
    const c1 = m15[i];
    const range = c1.high - c1.low;
    if (range <= 0) continue;
    const body = Math.abs(c1.close - c1.open);
    if (body / range < bodyRatio) continue;

    const side: "long" | "short" = c1.close >= c1.open ? "long" : "short";
    const c2 = m15[i + 1];
    const isLong = side === "long";

    const entry = isLong ? c1.high : c1.low;
    // target fix di 0.5 extension range C1 (fib 1.5 dari C1)
    const target = isLong ? c1.high + range * 0.5 : c1.low - range * 0.5;
    if (isLong ? target <= entry : target >= entry) continue;

    // C2 must pull back before triggering the stop order
    const pulledBack = isLong ? c2.low < c1.high : c2.high > c1.low;
    if (!pulledBack) continue;

    // invalidated: C2 breaks the opposite side of C1 → cancel the pending order
    const invalidated = isLong ? c2.low < c1.low : c2.high > c1.high;
    const triggered = isLong ? c2.high >= entry : c2.low <= entry;

    if (invalidated && !triggered) {
      return {
        date, side, c1Time: hhmm(c1.d), c2Time: hhmm(c2.d),
        entry, stop: isLong ? c2.low : c2.high, target, risk: 0,
        outcome: "cancelled", rMultiple: 0, pnlUsd: 0,
      };
    }
    if (!triggered) {
      return {
        date, side, c1Time: hhmm(c1.d), c2Time: hhmm(c2.d),
        entry, stop: isLong ? c2.low : c2.high, target, risk: 0,
        outcome: "no-trigger", rMultiple: 0, pnlUsd: 0,
      };
    }

    // triggered → SL frozen at the C2 extreme
    const stop = isLong ? c2.low : c2.high;
    const risk = Math.abs(entry - stop);
    if (risk <= 0) continue;

    let outcome: NYOrbTrade["outcome"] = "open";
    let rMultiple = 0;
    let exitTime: string | undefined;

    const path = m15.slice(i + 1);
    for (const b of path) {
      const hitTp = isLong ? b.high >= target : b.low <= target;
      const hitSl = isLong ? b.low <= stop : b.high >= stop;
      if (hitSl && hitTp) { outcome = "loss"; rMultiple = -1; exitTime = hhmm(b.d); break; }
      if (hitTp) { outcome = "win"; rMultiple = Math.abs(target - entry) / risk; exitTime = hhmm(b.d); break; }
      if (hitSl) { outcome = "loss"; rMultiple = -1; exitTime = hhmm(b.d); break; }
    }
    if (outcome === "open") {
      const last = path[path.length - 1];
      rMultiple = (isLong ? last.close - entry : entry - last.close) / risk;
      exitTime = hhmm(last.d);
    }

    return { date, side, c1Time: hhmm(c1.d), c2Time: hhmm(c2.d), entry, stop, target, risk, outcome, rMultiple, pnlUsd: rMultiple * FIXED_RISK_USD, exitTime };
  }
  return undefined;
}

/** Adapter to the generic quant trade shape. */
export function nyOrbQuantTrades(result: NYOrbResult) {
  return result.trades.map((t) => ({
    date: t.date,
    side: t.side,
    entry: t.entry,
    exit: t.outcome === "win" ? t.target : t.outcome === "loss" ? t.stop : undefined,
    risk: t.risk,
    outcome: (t.rMultiple > 0 ? "win" : "loss") as "win" | "loss",
    rMultiple: t.rMultiple,
  }));
}
