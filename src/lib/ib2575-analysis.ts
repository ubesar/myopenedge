import { parse } from "date-fns";
import type { CandleBar } from "./m15-aggregation";
import type { TpStats, DirStats, TradeDirection, TradeOutcome } from "./momentum-analysis";
import { computeMomentumFlagsByDay } from "./momentum-candle";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface IB2575Trade {
  date: string;
  direction: TradeDirection;   // bullish = IB low formed first, bearish = IB high formed first
  firstFormed: "high" | "low";
  ibHigh: number;
  ibLow: number;
  ib25: number;
  ib50: number;
  ib75: number;
  entry: number;               // limit @ IB75 (long) or IB25 (short)
  stop: number;                // IB50
  target: number;              // IBH (long) or IBL (short) — RR 1:1
  confirmTime: string | null;  // HH:MM of the m5 momentum candle that confirmed the setup
  entryTime: string | null;    // HH:MM when the limit order got filled
  triggered: boolean;          // limit order filled
  outcome: TradeOutcome;
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
const SCAN_END = 13 * 60;      // momentum confirmation scan stops at 13:00 NY
const MARKET_CLOSE = 16 * 60;

function parseDateTime(dt: string): Date { return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date()); }
function timeMin(dt: Date): number { return dt.getHours() * 60 + dt.getMinutes(); }
function minOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
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

/** Walk m5 bars from startIdx: fill the limit order, then resolve SL/TP (same-bar both → loss). */
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
    if (minOf(b.time) >= MARKET_CLOSE) break;
    if (!triggered) {
      // limit fill: price must trade back into the entry level
      const hit = direction === "bullish" ? b.low <= entry : b.high >= entry;
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
  return { triggered, entryTime, outcome: "open" };
}

/**
 * IB momentum limit strategy.
 * 1. Build the initial balance from the first `ibWindow` minutes of RTH (default 60min).
 * 2. Detect which IB extreme printed first.
 * 3. Low first  → wait for an m5 momentum (super body) candle closing ABOVE IB75, then buy limit @ IB75 (SL IB50, TP IBH).
 *    High first → wait for an m5 momentum candle closing BELOW IB25, then sell limit @ IB25 (SL IB50, TP IBL).
 * 4. Momentum scan window: IB end → 13:00 NY. Position managed until 16:00 NY.
 */
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

  // Build per-day m5 RTH series first so momentum flags carry the rolling average across days.
  const daySeries: { date: string; m5: CandleBar[] }[] = [];
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
    daySeries.push({ date, m5 });
  }

  const flagsByDay = computeMomentumFlagsByDay(daySeries.map((d) => d.m5));

  const trades: IB2575Trade[] = [];
  let totalDays = 0;
  let daysWithSignal = 0;

  for (let d = 0; d < daySeries.length; d++) {
    const { date, m5 } = daySeries[d];
    const flags = flagsByDay[d];

    const ibBars: CandleBar[] = [];
    let firstPostIB = -1;
    for (let i = 0; i < m5.length; i++) {
      const t = minOf(m5[i].time);
      if (t >= RTH_START && t < IB_END) ibBars.push(m5[i]);
      else if (t >= IB_END) { firstPostIB = i; break; }
    }
    if (ibBars.length === 0 || firstPostIB === -1) continue;

    const ibHigh = Math.max(...ibBars.map((b) => b.high));
    const ibLow = Math.min(...ibBars.map((b) => b.low));
    const range = ibHigh - ibLow;
    if (range <= 0) continue;

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
      const b = ibBars[highBar];
      firstFormed = b.close >= b.open ? "low" : "high";
    }

    totalDays++;

    const ib25 = ibLow + range * 0.25;
    const ib50 = ibLow + range * 0.5;
    const ib75 = ibLow + range * 0.75;

    const direction: TradeDirection = firstFormed === "low" ? "bullish" : "bearish";
    const entry = direction === "bullish" ? ib75 : ib25;
    const target = direction === "bullish" ? ibHigh : ibLow;
    const stop = ib50;

    // Confirmation: m5 momentum candle that CROSSES the level and closes beyond it, before 13:00.
    let confirmIdx = -1;
    for (let i = firstPostIB; i < m5.length; i++) {
      const t = minOf(m5[i].time);
      if (t >= SCAN_END) break;
      const f = flags[i];
      if (!f?.isSuper || !f.direction) continue;
      if (f.direction !== direction) continue;
      const c = m5[i];
      const crossed =
        direction === "bullish"
          ? c.close > ib75 && Math.min(c.open, c.low) <= ib75
          : c.close < ib25 && Math.max(c.open, c.high) >= ib25;
      if (!crossed) continue;
      confirmIdx = i;
      break;
    }

    if (confirmIdx === -1) continue;

    const { triggered, entryTime, outcome } = walk(m5, confirmIdx + 1, direction, entry, stop, target);

    trades.push({
      date,
      direction,
      firstFormed,
      ibHigh, ibLow,
      ib25, ib50, ib75,
      entry, stop, target,
      confirmTime: m5[confirmIdx].time,
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
