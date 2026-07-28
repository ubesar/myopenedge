import { parse } from "date-fns";
import type { CandleBar } from "./m15-aggregation";
import type { TpStats, DirStats, TradeDirection, TradeOutcome } from "./momentum-analysis";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface IB2575Trade {
  date: string;
  direction: TradeDirection;   // bullish = low-first (long @ IB75), bearish = high-first (short @ IB25)
  firstFormed: "high" | "low"; // which extreme printed first during IB
  ibHigh: number;
  ibLow: number;
  ib25: number;                // 25% level from IBL
  ib50: number;                // midpoint (stop)
  ib75: number;                // 75% level from IBL
  entry: number;               // IB75 (bullish) or IB25 (bearish)
  stop: number;                // IB50
  target: number;              // IBH (bullish) or IBL (bearish) — RR 1:1
  entryTime: string | null;    // HH:MM when entry level first touched, null if never
  triggered: boolean;          // whether entry level was touched between IB end and 16:00
  outcome: TradeOutcome;       // win/loss/open
}

export interface IB2575Result {
  totalDays: number;
  daysWithSignal: number;
  totalTrades: number;
  triggeredTrades: number;
  ibWindowMinutes: number;
  stats: TpStats;
  trades: IB2575Trade[];
}

const RTH_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;

function parseDateTime(dt: string): Date { return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date()); }
function timeMin(dt: Date): number { return dt.getHours() * 60 + dt.getMinutes(); }
function emptyDir(): DirStats { return { total: 0, wins: 0, losses: 0, winRate: 0 }; }
function emptyTp(): TpStats {
  return { total: 0, wins: 0, losses: 0, open: 0, winRate: 0, bullish: emptyDir(), bearish: emptyDir() };
}
function finalizeTp(s: TpStats) {
  const dw = s.wins + s.losses;
  s.winRate = dw > 0 ? (s.wins / dw) * 100 : 0;
  const bd = s.bullish.wins + s.bullish.losses;
  s.bullish.winRate = bd > 0 ? (s.bullish.wins / bd) * 100 : 0;
  const rd = s.bearish.wins + s.bearish.losses;
  s.bearish.winRate = rd > 0 ? (s.bearish.wins / rd) * 100 : 0;
}

/**
 * Walk m5 bars starting at index `startIdx` looking for the entry touch, then resolve SL/TP.
 * Bullish (buy @ IB25, SL IB50, TP IB high): triggers when bar.low <= entry.
 * Bearish (sell @ IB25, SL IB50, TP IB low): triggers when bar.high >= entry.
 * In the trigger bar and subsequent bars, if both SL and TP are hit in the same bar → conservative loss.
 */
function walk(
  m5: CandleBar[],
  startIdx: number,
  direction: TradeDirection,
  entry: number,
  stop: number,
  target: number,
): { triggered: boolean; entryTime: string | null; outcome: TradeOutcome } {
  let triggered = false;
  let entryTime: string | null = null;
  for (let i = startIdx; i < m5.length; i++) {
    const b = m5[i];
    if (!triggered) {
      // first touch of the entry level (either from above or below)
      const hit = b.low <= entry && b.high >= entry;
      if (!hit) continue;
      triggered = true;
      entryTime = b.time;
    }
    const hitStop = direction === "bullish" ? b.low <= stop : b.high >= stop;
    const hitTp = direction === "bullish" ? b.high >= target : b.low <= target;
    if (hitStop && hitTp) return { triggered, entryTime, outcome: "loss" };
    if (hitTp) return { triggered, entryTime, outcome: "win" };
    if (hitStop) return { triggered, entryTime, outcome: "loss" };
  }
  return { triggered, entryTime, outcome: triggered ? "open" : "open" };
}

export function analyzeIB2575(
  bars: BarData[],
  ibWindow: number = 60,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
): IB2575Result {
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }
  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter((d) => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  const IB_END = RTH_START + ibWindow;

  const trades: IB2575Trade[] = [];
  let totalDays = 0;
  let daysWithSignal = 0;

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const sessionRaw = dayBars.filter((b) => {
      const m = timeMin(parseDateTime(b.datetime));
      return m >= RTH_START && m < MARKET_CLOSE;
    });
    if (sessionRaw.length === 0) continue;

    const m5: CandleBar[] = sessionRaw.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    if (m5[0].time !== "09:30") continue;

    // IB bars: 09:30 up to (not including) IB_END
    const ibBars: CandleBar[] = [];
    let firstPostIB = -1;
    for (let i = 0; i < m5.length; i++) {
      const [h, mi] = m5[i].time.split(":").map(Number);
      const t = h * 60 + mi;
      if (t >= RTH_START && t < IB_END) ibBars.push(m5[i]);
      else if (t >= IB_END) { firstPostIB = i; break; }
    }
    if (ibBars.length === 0 || firstPostIB === -1) continue;

    const ibHigh = Math.max(...ibBars.map((b) => b.high));
    const ibLow = Math.min(...ibBars.map((b) => b.low));
    const range = ibHigh - ibLow;
    if (range <= 0) continue;

    // Determine which extreme printed first during IB
    let highBar = -1;
    let lowBar = -1;
    for (let i = 0; i < ibBars.length; i++) {
      if (highBar === -1 && ibBars[i].high >= ibHigh) highBar = i;
      if (lowBar === -1 && ibBars[i].low <= ibLow) lowBar = i;
    }
    let firstFormed: "high" | "low";
    if (highBar < lowBar) firstFormed = "high";
    else if (lowBar < highBar) firstFormed = "low";
    else {
      // same bar formed both extremes → use candle directionality as tiebreaker
      // bullish candle (close > open) likely printed low first then rallied to high → low first
      const b = ibBars[highBar];
      firstFormed = b.close >= b.open ? "low" : "high";
    }

    totalDays++;

    let direction: TradeDirection;
    let ib25: number;
    let target: number;
    if (firstFormed === "low") {
      // fib drawn from low(100) → high(0). IB25 sits 25% up from low.
      direction = "bullish";
      ib25 = ibLow + range * 0.25;
      target = ibHigh;
    } else {
      // fib drawn from high(100) → low(0). IB25 sits 25% down from high.
      direction = "bearish";
      ib25 = ibHigh - range * 0.25;
      target = ibLow;
    }
    const ib50 = ibLow + range * 0.5;
    const entry = ib25;
    const stop = ib50;

    const { triggered, entryTime, outcome } = walk(m5, firstPostIB, direction, entry, stop, target);

    trades.push({
      date,
      direction,
      firstFormed,
      ibHigh, ibLow,
      ib25, ib50,
      entry, stop, target,
      entryTime,
      triggered,
      outcome,
    });
    if (triggered) daysWithSignal++;
  }

  const stats = emptyTp();
  let triggeredTrades = 0;
  for (const t of trades) {
    if (!t.triggered) continue;
    triggeredTrades++;
    stats.total++;
    const bucket = t.direction === "bullish" ? stats.bullish : stats.bearish;
    bucket.total++;
    if (t.outcome === "win") { stats.wins++; bucket.wins++; }
    else if (t.outcome === "loss") { stats.losses++; bucket.losses++; }
    else stats.open++;
  }
  finalizeTp(stats);

  return {
    totalDays,
    daysWithSignal,
    totalTrades: triggeredTrades,
    triggeredTrades,
    ibWindowMinutes: ibWindow,
    stats,
    trades,
  };
}
