import { parse } from "date-fns";
import type { TradeDirection, TradeOutcome } from "./momentum-analysis";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type FormedFirst = "high" | "low";
export type FirstBreakout = "high" | "low" | "none";

export interface ORBM15Day {
  date: string;
  orbHigh: number;
  orbLow: number;
  formedFirst: FormedFirst;
  firstBreakout: FirstBreakout;
  breakoutTime: string | null;
}

export interface ORBM15SideStats {
  total: number;
  breakHigh: number;
  breakLow: number;
  noBreak: number;
  breakHighPct: number;
  breakLowPct: number;
}

export interface ORBM15Trade {
  date: string;
  time: string;
  direction: TradeDirection;
  entry: number;
  stop: number;
  target: number;
  outcome: TradeOutcome;
  orbHigh: number;
  orbLow: number;
}

export interface ORBM15Result {
  totalDays: number;
  highFirst: ORBM15SideStats;
  lowFirst: ORBM15SideStats;
  days: ORBM15Day[];
  trades: ORBM15Trade[];
  wins: number;
  losses: number;
  winRate: number;
  /** Bias of the most recent session in the dataset. */
  latestBias: {
    date: string;
    formedFirst: FormedFirst;
    expected: FormedFirst;
    probability: number;
  } | null;
}

const ORB_START = 9 * 60 + 30; // 09:30 NY
const ORB_END = 9 * 60 + 45;   // 09:45 NY (09:30 / 09:35 / 09:40 m5 candles)
const MARKET_CLOSE = 16 * 60;

interface Bar {
  min: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function label(min: number) { return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`; }

function emptySide(): ORBM15SideStats {
  return { total: 0, breakHigh: 0, breakLow: 0, noBreak: 0, breakHighPct: 0, breakLowPct: 0 };
}
function finalizeSide(s: ORBM15SideStats) {
  const resolved = s.breakHigh + s.breakLow;
  s.breakHighPct = resolved > 0 ? (s.breakHigh / resolved) * 100 : 0;
  s.breakLowPct = resolved > 0 ? (s.breakLow / resolved) * 100 : 0;
}

/**
 * NY Open ORB m15 — opening range = 09:30 → 09:45 (three m5 candles).
 * Detect which extreme (high or low) printed first inside that window, then
 * measure which side of the range price breaks first afterwards.
 * The tradeable edge fades the extreme formed first (mean reversion), 1:1 RR.
 */
export function analyzeORBM15(
  bars: BarData[],
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
  closeMinutes: number = MARKET_CLOSE,
): ORBM15Result {
  const byDate = new Map<string, Bar[]>();
  for (const b of bars) {
    const dt = parse(b.datetime, "yyyy-MM-dd HH:mm:ss", new Date());
    const date = b.datetime.split(" ")[0];
    const min = dt.getHours() * 60 + dt.getMinutes();
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({
      min,
      time: label(min),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    });
  }

  let dates = Array.from(byDate.keys()).sort();
  dates = dates.filter((d) => weekdays.includes(new Date(d + "T12:00:00").getDay()));
  if (maxDays > 0) dates = dates.slice(-maxDays);

  const highFirst = emptySide();
  const lowFirst = emptySide();
  const days: ORBM15Day[] = [];
  const trades: ORBM15Trade[] = [];

  for (const date of dates) {
    const all = (byDate.get(date) ?? []).sort((a, b) => a.min - b.min);
    const orbBars = all.filter((b) => b.min >= ORB_START && b.min < ORB_END);
    if (orbBars.length === 0) continue;

    let orbHigh = -Infinity;
    let orbLow = Infinity;
    let highIdx = 0;
    let lowIdx = 0;
    orbBars.forEach((b, i) => {
      if (b.high > orbHigh) { orbHigh = b.high; highIdx = i; }
      if (b.low < orbLow) { orbLow = b.low; lowIdx = i; }
    });
    if (!isFinite(orbHigh) || !isFinite(orbLow) || orbHigh <= orbLow) continue;

    let formedFirst: FormedFirst;
    if (highIdx !== lowIdx) {
      formedFirst = highIdx < lowIdx ? "high" : "low";
    } else {
      // same candle: a bullish candle prints its low first, bearish prints its high first
      const b = orbBars[highIdx];
      formedFirst = b.close >= b.open ? "low" : "high";
    }

    // Breakout scan after the opening range
    const after = all.filter((b) => b.min >= ORB_END && b.min < closeMinutes);
    let firstBreakout: FirstBreakout = "none";
    let breakoutTime: string | null = null;
    for (const b of after) {
      const hitHigh = b.high > orbHigh;
      const hitLow = b.low < orbLow;
      if (hitHigh && hitLow) {
        firstBreakout = b.close >= b.open ? "low" : "high";
      } else if (hitHigh) {
        firstBreakout = "high";
      } else if (hitLow) {
        firstBreakout = "low";
      } else {
        continue;
      }
      breakoutTime = b.time;
      break;
    }

    const side = formedFirst === "high" ? highFirst : lowFirst;
    side.total++;
    if (firstBreakout === "high") side.breakHigh++;
    else if (firstBreakout === "low") side.breakLow++;
    else side.noBreak++;

    days.push({ date, orbHigh, orbLow, formedFirst, firstBreakout, breakoutTime });

    // Trade: fade the extreme formed first, market entry at the 09:45 open, 1:1 RR
    const first = after[0];
    if (first) {
      const direction: TradeDirection = formedFirst === "low" ? "bullish" : "bearish";
      const entry = first.open;
      const stop = direction === "bullish" ? orbLow : orbHigh;
      const risk = Math.abs(entry - stop);
      if (risk > 0) {
        const target = direction === "bullish" ? entry + risk : entry - risk;
        let outcome: TradeOutcome = "open";
        for (const b of after) {
          const hitStop = direction === "bullish" ? b.low <= stop : b.high >= stop;
          const hitTarget = direction === "bullish" ? b.high >= target : b.low <= target;
          if (hitStop && hitTarget) { outcome = "loss"; break; }
          if (hitTarget) { outcome = "win"; break; }
          if (hitStop) { outcome = "loss"; break; }
        }
        trades.push({
          date, time: first.time, direction, entry, stop, target, outcome,
          orbHigh, orbLow,
        });
      }
    }
  }

  finalizeSide(highFirst);
  finalizeSide(lowFirst);

  const wins = trades.filter((t) => t.outcome === "win").length;
  const losses = trades.filter((t) => t.outcome === "loss").length;

  const last = days[days.length - 1];
  const latestBias = last
    ? {
        date: last.date,
        formedFirst: last.formedFirst,
        expected: (last.formedFirst === "low" ? "high" : "low") as FormedFirst,
        probability: last.formedFirst === "low" ? lowFirst.breakHighPct : highFirst.breakLowPct,
      }
    : null;

  return {
    totalDays: days.length,
    highFirst,
    lowFirst,
    days,
    trades,
    wins,
    losses,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    latestBias,
  };
}
