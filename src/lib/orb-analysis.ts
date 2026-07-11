import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";
import type { TpStats, DirStats, TradeDirection, TradeOutcome } from "./momentum-analysis";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type ORBTimeframe = 5 | 15 | 30;

export type ORBCandleMode = "momentum" | "any";

export interface ORBTrade {
  date: string;
  timeframe: ORBTimeframe;
  orbTime: string;         // opening candle time (e.g. "09:30")
  direction: TradeDirection;
  entry: number;           // buy/sell stop price = ORB high (bull) / low (bear)
  stop: number;            // opposite end of ORB
  tp1: number;             // RR 1:0.5
  tp2: number;             // RR 1:1
  range: number;
  triggered: boolean;
  outcomeTp1: TradeOutcome; // win = TP1 hit before SL, loss = SL hit first, open = neither
  outcomeTp2: TradeOutcome;
}

export interface ORBResult {
  timeframe: ORBTimeframe;
  candleMode: ORBCandleMode;
  totalDays: number;
  daysWithSignal: number;
  bodyThreshold: number;
  totalTrades: number;
  triggeredTrades: number;
  tp1Stats: TpStats;       // RR 1:0.5
  tp2Stats: TpStats;       // RR 1:1
  trades: ORBTrade[];
}

const RTH_START = 9 * 60 + 30; // 09:30 NY
const MARKET_CLOSE = 16 * 60;  // 16:00 NY
const BODY_THRESHOLD = 0.7;

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
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
 * Resolve ORB trade against m5 bars after the ORB candle closes.
 * Trigger: bullish price >= entry (ORB high). Bearish price <= entry (ORB low).
 * After trigger, TP1/TP2 tracked independently until SL hit or market close.
 * If SL and TP hit in same bar -> conservative loss.
 */
function resolveORB(
  m5: CandleBar[],
  startIdx: number,
  direction: TradeDirection,
  entry: number,
  stop: number,
  tp1: number,
  tp2: number,
): { triggered: boolean; outcomeTp1: TradeOutcome; outcomeTp2: TradeOutcome } {
  let triggered = false;
  let outcomeTp1: TradeOutcome = "open";
  let outcomeTp2: TradeOutcome = "open";
  let tp1Resolved = false;
  let tp2Resolved = false;

  for (let i = startIdx; i < m5.length; i++) {
    const b = m5[i];
    if (!triggered) {
      const trig = direction === "bullish" ? b.high >= entry : b.low <= entry;
      if (!trig) continue;
      triggered = true;
    }
    const hitStop = direction === "bullish" ? b.low <= stop : b.high >= stop;
    const hitTp1 = direction === "bullish" ? b.high >= tp1 : b.low <= tp1;
    const hitTp2 = direction === "bullish" ? b.high >= tp2 : b.low <= tp2;

    if (!tp1Resolved) {
      if (hitStop && hitTp1) { outcomeTp1 = "loss"; tp1Resolved = true; }
      else if (hitTp1) { outcomeTp1 = "win"; tp1Resolved = true; }
      else if (hitStop) { outcomeTp1 = "loss"; tp1Resolved = true; }
    }
    if (!tp2Resolved) {
      if (hitStop && hitTp2) { outcomeTp2 = "loss"; tp2Resolved = true; }
      else if (hitTp2) { outcomeTp2 = "win"; tp2Resolved = true; }
      else if (hitStop) { outcomeTp2 = "loss"; tp2Resolved = true; }
    }
    if (tp1Resolved && tp2Resolved) break;
  }
  return { triggered, outcomeTp1, outcomeTp2 };
}

export function analyzeORB(
  bars: BarData[],
  timeframe: ORBTimeframe,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
  candleMode: ORBCandleMode = "momentum",
): ORBResult {
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

  const trades: ORBTrade[] = [];
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

    // Build ORB candle
    const orbBarsNeeded = timeframe / 5;
    if (m5.length < orbBarsNeeded + 1) continue;
    // Ensure first bar starts at 09:30
    if (m5[0].time !== "09:30") continue;

    const orbSlice = m5.slice(0, orbBarsNeeded);
    const orb: CandleBar = {
      time: orbSlice[0].time,
      open: orbSlice[0].open,
      high: Math.max(...orbSlice.map((b) => b.high)),
      low: Math.min(...orbSlice.map((b) => b.low)),
      close: orbSlice[orbSlice.length - 1].close,
    };

    totalDays++;

    const range = orb.high - orb.low;
    if (range <= 0) continue;
    const body = Math.abs(orb.close - orb.open);
    if (orb.close === orb.open) continue;
    if (body / range < BODY_THRESHOLD) continue;

    const direction: TradeDirection = orb.close > orb.open ? "bullish" : "bearish";
    const entry = direction === "bullish" ? orb.high : orb.low;
    const stop = direction === "bullish" ? orb.low : orb.high;
    const tp1 = direction === "bullish" ? entry + range * 0.5 : entry - range * 0.5;
    const tp2 = direction === "bullish" ? entry + range : entry - range;

    const r = resolveORB(m5, orbBarsNeeded, direction, entry, stop, tp1, tp2);

    trades.push({
      date,
      timeframe,
      orbTime: orb.time,
      direction,
      entry,
      stop,
      tp1,
      tp2,
      range,
      triggered: r.triggered,
      outcomeTp1: r.triggered ? r.outcomeTp1 : "open",
      outcomeTp2: r.triggered ? r.outcomeTp2 : "open",
    });
    daysWithSignal++;
  }

  const tp1Stats = emptyTp();
  const tp2Stats = emptyTp();
  let triggeredTrades = 0;
  for (const t of trades) {
    if (t.triggered) triggeredTrades++;

    tp1Stats.total++;
    const b1 = t.direction === "bullish" ? tp1Stats.bullish : tp1Stats.bearish;
    b1.total++;
    if (t.outcomeTp1 === "win") { tp1Stats.wins++; b1.wins++; }
    else if (t.outcomeTp1 === "loss") { tp1Stats.losses++; b1.losses++; }
    else tp1Stats.open++;

    tp2Stats.total++;
    const b2 = t.direction === "bullish" ? tp2Stats.bullish : tp2Stats.bearish;
    b2.total++;
    if (t.outcomeTp2 === "win") { tp2Stats.wins++; b2.wins++; }
    else if (t.outcomeTp2 === "loss") { tp2Stats.losses++; b2.losses++; }
    else tp2Stats.open++;
  }
  finalizeTp(tp1Stats);
  finalizeTp(tp2Stats);

  return {
    timeframe,
    totalDays,
    daysWithSignal,
    bodyThreshold: BODY_THRESHOLD,
    totalTrades: trades.length,
    triggeredTrades,
    tp1Stats,
    tp2Stats,
    trades,
  };
}

// Keep aggregateBars import used (satisfy tree-shaker & future extensions)
void aggregateBars;
