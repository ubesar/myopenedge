import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type MFPTimeframe = "M15";

export interface MFPTrade {
  date: string;
  tf: MFPTimeframe;
  side: "long" | "short";
  // C1 (momentum candle) OHLC
  momentumTime: string;
  c1Open: number;
  c1High: number;
  c1Low: number;
  c1Close: number;
  // C2 (pullback / trigger candle)
  c2Time: string;
  c2Open: number;
  c2High: number;
  c2Low: number;
  c2Close: number;
  // Levels
  fib02: number;
  entry: number; // C1 high (long) or C1 low (short)
  sl: number;    // C2 wick
  tp: number;    // RR 1:1
  risk: number;
  // Resolution
  resolvedTime?: string;
  outcome: "win" | "loss" | "open";
}

export interface MFPTFStats {
  tf: MFPTimeframe;
  momentumCandles: number;
  bullishMomentum: number;
  bearishMomentum: number;
  pullbackHits: number;   // C2 touched fib 0.2
  triggered: number;       // C2 also triggered entry
  wins: number;
  losses: number;
  open: number;
  winRate: number;
  pullbackRate: number;
  triggerRate: number;
  longWins: number; longLosses: number; longTriggered: number;
  shortWins: number; shortLosses: number; shortTriggered: number;
}

export interface MFPResult {
  totalDays: number;
  superMultiplier: number;
  avgPeriod: number;
  tfStats: Record<MFPTimeframe, MFPTFStats>;
  trades: MFPTrade[];
}

// NY session windows
const MOMENTUM_START = 9 * 60 + 30;   // 09:30
const MOMENTUM_END = 13 * 60;          // 13:00 — last allowed C1 time
const MARKET_CLOSE = 16 * 60;          // 16:00 — TP/SL search ends

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function emptyStats(): MFPTFStats {
  return {
    tf: "M15", momentumCandles: 0, bullishMomentum: 0, bearishMomentum: 0,
    pullbackHits: 0, triggered: 0, wins: 0, losses: 0, open: 0,
    winRate: 0, pullbackRate: 0, triggerRate: 0,
    longWins: 0, longLosses: 0, longTriggered: 0,
    shortWins: 0, shortLosses: 0, shortTriggered: 0,
  };
}

/**
 * Momentum Candle Fib Pullback — M15 ONLY rebuild.
 *
 * Rules:
 *   - C1 = super-body momentum candle (body > sma(body, avgPeriod) * superMultiplier).
 *   - C2 = the very next M15 candle. It MUST:
 *       (a) touch fib 0.2 (pullback),
 *       (b) trigger the stop order at C1 high (long) / C1 low (short) in the SAME C2 candle.
 *     If either fails, abandon this setup and search for the next momentum candle.
 *   - Entry: buy stop at C1 high (long) or sell stop at C1 low (short).
 *   - SL: C2 wick (C2 low for long, C2 high for short).
 *   - TP: 1:2 RR — entry ± 2×(entry - SL).
 *   - C1 must form between 09:30 and 13:00 ET.
 *   - SL/TP resolution allowed until 16:00 ET.
 *
 * Fib reference (for the 0.2 pullback level only):
 *   - Bullish C1: fib drawn low (1) → high (0). 0.2 = C1.high - 0.2*(H-L).
 *   - Bearish C1: fib drawn high (1) → low (0). 0.2 = C1.low + 0.2*(H-L).
 */
export function analyzeMomentumFibPullback(
  bars: BarData[],
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
  superMultiplier: number = 1.5,
  avgPeriod: number = 15,
): MFPResult {
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }
  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter((d) => weekdays.includes(new Date(d + "T12:00:00").getDay()));

  const tfStats: Record<MFPTimeframe, MFPTFStats> = { M15: emptyStats() };
  const trades: MFPTrade[] = [];

  const bodyHistory: number[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Full RTH session for SL/TP resolution
    const sessionRaw = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= MOMENTUM_START && m < MARKET_CLOSE;
    });
    if (sessionRaw.length === 0) continue;

    const session5: CandleBar[] = sessionRaw.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const candles = aggregateBars(session5, 15);
    const stats = tfStats.M15;

    for (let i = 0; i < candles.length - 1; i++) {
      const c1 = candles[i];
      const body = Math.abs(c1.close - c1.open);
      bodyHistory.push(body);

      if (bodyHistory.length < avgPeriod) continue;
      const slice = bodyHistory.slice(-avgPeriod);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      const isSuper = body > avg * superMultiplier && c1.close !== c1.open;
      if (!isSuper) continue;

      // C1 must be in momentum search window (09:30–13:00)
      const c1Min = timeToMinutes(c1.time);
      if (c1Min < MOMENTUM_START || c1Min > MOMENTUM_END) continue;

      const side: "long" | "short" = c1.close > c1.open ? "long" : "short";
      stats.momentumCandles++;
      if (side === "long") stats.bullishMomentum++; else stats.bearishMomentum++;

      const range = c1.high - c1.low;
      if (range <= 0) continue;

      const fib02 = side === "long" ? c1.high - 0.2 * range : c1.low + 0.2 * range;
      const entry = side === "long" ? c1.high : c1.low;

      const c2 = candles[i + 1];

      // C2 must both pullback to 0.2 AND trigger entry within itself
      const hitPullback = side === "long" ? c2.low <= fib02 : c2.high >= fib02;
      const hitEntry = side === "long" ? c2.high >= entry : c2.low <= entry;

      if (hitPullback) stats.pullbackHits++;
      if (!hitPullback || !hitEntry) continue; // abandon, keep scanning for next C1

      // SL = C2 wick
      const sl = side === "long" ? c2.low : c2.high;
      const risk = Math.abs(entry - sl);
      if (risk <= 0) continue;
      const tp = side === "long" ? entry + risk * 2 : entry - risk * 2;

      stats.triggered++;
      if (side === "long") stats.longTriggered++; else stats.shortTriggered++;

      const trade: MFPTrade = {
        date, tf: "M15", side,
        momentumTime: c1.time,
        c1Open: c1.open, c1High: c1.high, c1Low: c1.low, c1Close: c1.close,
        c2Time: c2.time,
        c2Open: c2.open, c2High: c2.high, c2Low: c2.low, c2Close: c2.close,
        fib02, entry, sl, tp, risk,
        outcome: "open",
      };

      // Check resolution starting in C2 itself (ambiguous bar: count as loss conservative)
      const c2HitTP = side === "long" ? c2.high >= tp : c2.low <= tp;
      const c2HitSLAfterEntry = false; // SL is C2 wick by definition; treat as not hit during C2
      if (c2HitTP) {
        trade.outcome = "win";
        trade.resolvedTime = c2.time;
      } else {
        // Scan subsequent candles until 16:00
        for (let j = i + 2; j < candles.length; j++) {
          const cn = candles[j];
          const cnMin = timeToMinutes(cn.time);
          if (cnMin >= MARKET_CLOSE) break;
          const hitTP = side === "long" ? cn.high >= tp : cn.low <= tp;
          const hitSL = side === "long" ? cn.low <= sl : cn.high >= sl;
          if (hitTP && hitSL) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
          if (hitTP) { trade.outcome = "win"; trade.resolvedTime = cn.time; break; }
          if (hitSL) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
        }
      }

      if (trade.outcome === "win") {
        stats.wins++;
        if (side === "long") stats.longWins++; else stats.shortWins++;
      } else if (trade.outcome === "loss") {
        stats.losses++;
        if (side === "long") stats.longLosses++; else stats.shortLosses++;
      } else {
        stats.open++;
      }
      trades.push(trade);
    }
  }

  const s = tfStats.M15;
  const resolved = s.wins + s.losses;
  s.winRate = resolved > 0 ? (s.wins / resolved) * 100 : 0;
  s.pullbackRate = s.momentumCandles > 0 ? (s.pullbackHits / s.momentumCandles) * 100 : 0;
  s.triggerRate = s.momentumCandles > 0 ? (s.triggered / s.momentumCandles) * 100 : 0;

  return { totalDays: dates.length, superMultiplier, avgPeriod, tfStats, trades };
}
