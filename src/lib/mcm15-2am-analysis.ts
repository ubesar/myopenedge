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

export interface MCM152amTrade {
  date: string;
  scanTime: string;      // "02:00" or "02:15" (NY)
  direction: TradeDirection;
  entry: number;         // buy/sell stop at high (bull) / low (bear)
  stop: number;          // opposite end
  tp1: number;           // RR 1:0.5
  tp2: number;           // RR 1:1
  range: number;
  triggered: boolean;
  outcomeTp1: TradeOutcome;
  outcomeTp2: TradeOutcome;
}

export interface MCM152amResult {
  totalDays: number;
  daysWithSignal: number;
  bodyThreshold: number;
  totalTrades: number;
  triggeredTrades: number;
  scan0200: number;      // signals originating from 02:00 scan
  scan0215: number;      // signals originating from 02:15 fallback
  tp1Stats: TpStats;
  tp2Stats: TpStats;
  trades: MCM152amTrade[];
}

const SCAN_1 = 2 * 60;       // 02:00 NY
const SCAN_2 = 2 * 60 + 15;  // 02:15 NY
const SESSION_END = 16 * 60; // walk-forward until 16:00 NY
const BODY_THRESHOLD = 0.7;
const TF_MINUTES = 15;

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

function isMomentum(c: CandleBar): { ok: boolean; dir: TradeDirection | null; range: number } {
  const range = c.high - c.low;
  if (range <= 0 || c.close === c.open) return { ok: false, dir: null, range: 0 };
  const body = Math.abs(c.close - c.open);
  if (body / range < BODY_THRESHOLD) return { ok: false, dir: null, range };
  return { ok: true, dir: c.close > c.open ? "bullish" : "bearish", range };
}

function resolve(
  m15: CandleBar[],
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

  for (let i = startIdx; i < m15.length; i++) {
    const b = m15[i];
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

export function analyzeMCM152am(
  bars: BarData[],
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
): MCM152amResult {
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

  const trades: MCM152amTrade[] = [];
  let totalDays = 0;
  let daysWithSignal = 0;
  let scan0200 = 0;
  let scan0215 = 0;

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Session window: from 02:00 NY to 16:00 NY (enough for scan + walk-forward)
    const sessionRaw = dayBars.filter((b) => {
      const m = timeMin(parseDateTime(b.datetime));
      return m >= SCAN_1 && m < SESSION_END;
    });
    if (sessionRaw.length === 0) continue;

    const m5: CandleBar[] = sessionRaw.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const m15 = aggregateBars(m5, TF_MINUTES);
    if (m15.length < 2) continue;
    totalDays++;

    // Find candles at 02:00 and 02:15
    const c0200 = m15.find((c) => c.time === "02:00");
    if (!c0200) continue;

    let chosen: { candle: CandleBar; idx: number; scanTime: string } | null = null;

    const mom1 = isMomentum(c0200);
    if (mom1.ok) {
      const idx = m15.indexOf(c0200);
      chosen = { candle: c0200, idx, scanTime: "02:00" };
      scan0200++;
    } else {
      const c0215 = m15.find((c) => c.time === "02:15");
      if (c0215) {
        const mom2 = isMomentum(c0215);
        if (mom2.ok) {
          const idx = m15.indexOf(c0215);
          chosen = { candle: c0215, idx, scanTime: "02:15" };
          scan0215++;
        }
      }
    }

    if (!chosen) continue;

    const { candle: c, idx, scanTime } = chosen;
    const mom = isMomentum(c);
    const direction = mom.dir!;
    const range = mom.range;
    const entry = direction === "bullish" ? c.high : c.low;
    const stop = direction === "bullish" ? c.low : c.high;
    const tp1 = direction === "bullish" ? entry + range * 0.5 : entry - range * 0.5;
    const tp2 = direction === "bullish" ? entry + range : entry - range;

    const r = resolve(m15, idx + 1, direction, entry, stop, tp1, tp2);

    trades.push({
      date,
      scanTime,
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
    totalDays,
    daysWithSignal,
    bodyThreshold: BODY_THRESHOLD,
    totalTrades: trades.length,
    triggeredTrades,
    scan0200,
    scan0215,
    tp1Stats,
    tp2Stats,
    trades,
  };
}
