import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type MFPTimeframe = "M5" | "M15" | "M30" | "H1";

export interface MFPTrade {
  date: string;
  tf: MFPTimeframe;
  side: "long" | "short";
  momentumTime: string; // C1 time
  pullbackTime?: string; // C2 (or later) when 0.2 touched
  triggerTime?: string;  // when stop order at fib 0 filled
  resolvedTime?: string;
  c1High: number;
  c1Low: number;
  fib02: number; // pullback level
  fib05: number; // SL
  fibNeg05: number; // TP
  entry: number; // fib 0
  outcome: "win" | "loss" | "no-pullback" | "no-trigger" | "open";
}

export interface MFPTFStats {
  tf: MFPTimeframe;
  momentumCandles: number;
  bullishMomentum: number;
  bearishMomentum: number;
  pullbackHits: number;     // how many momentum candles had a C2+ pullback to 0.2
  triggered: number;         // entries that filled at fib 0
  wins: number;
  losses: number;
  open: number;
  winRate: number;           // wins / (wins+losses)
  pullbackRate: number;      // pullbackHits / momentumCandles
  triggerRate: number;       // triggered / momentumCandles
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

const TF_CONFIGS: { tf: MFPTimeframe; minutes: number }[] = [
  { tf: "M5", minutes: 5 },
  { tf: "M15", minutes: 15 },
  { tf: "M30", minutes: 30 },
  { tf: "H1", minutes: 60 },
];

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

function emptyStats(tf: MFPTimeframe): MFPTFStats {
  return {
    tf, momentumCandles: 0, bullishMomentum: 0, bearishMomentum: 0,
    pullbackHits: 0, triggered: 0, wins: 0, losses: 0, open: 0,
    winRate: 0, pullbackRate: 0, triggerRate: 0,
    longWins: 0, longLosses: 0, longTriggered: 0,
    shortWins: 0, shortLosses: 0, shortTriggered: 0,
  };
}

/**
 * Momentum Candle Fib Pullback strategy.
 *
 * Detection of momentum candle C1: Pine "Super Body" → body > sma(body, avgPeriod) * superMultiplier
 *
 * Bullish C1 (close > open):
 *   - Fib drawn low (1) → high (0). So:
 *     fib 0   = C1.high  (entry, buy stop)
 *     fib 0.2 = C1.high - 0.2*(H-L)  (pullback target)
 *     fib 0.5 = C1.high - 0.5*(H-L)  (SL)
 *     fib -0.5= C1.high + 0.5*(H-L)  (TP)
 *   - C2+ must pullback DOWN and touch fib 0.2 (i.e. low <= fib02)
 *   - After touch, buy stop at fib 0; SL fib 0.5, TP fib -0.5.
 *
 * Bearish C1 (close < open):
 *   - Fib drawn high (1) → low (0):
 *     fib 0   = C1.low
 *     fib 0.2 = C1.low + 0.2*(H-L)
 *     fib 0.5 = C1.low + 0.5*(H-L)
 *     fib -0.5= C1.low - 0.5*(H-L)
 *   - C2+ must pullback UP and touch fib 0.2 (high >= fib02)
 *   - After touch, sell stop at fib 0; SL fib 0.5, TP fib -0.5.
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

  const tfStats: Record<MFPTimeframe, MFPTFStats> = {
    M5: emptyStats("M5"), M15: emptyStats("M15"),
    M30: emptyStats("M30"), H1: emptyStats("H1"),
  };
  const trades: MFPTrade[] = [];

  // Rolling body history per TF (Pine-like sma includes current bar)
  const bodyHistory: Record<MFPTimeframe, number[]> = { M5: [], M15: [], M30: [], H1: [] };

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const sessionRaw = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (sessionRaw.length === 0) continue;

    const session5: CandleBar[] = sessionRaw.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    for (const cfg of TF_CONFIGS) {
      const candles = aggregateBars(session5, cfg.minutes);
      const hist = bodyHistory[cfg.tf];
      const stats = tfStats[cfg.tf];

      for (let i = 0; i < candles.length; i++) {
        const c1 = candles[i];
        const body = Math.abs(c1.close - c1.open);
        hist.push(body);

        if (hist.length < avgPeriod) continue;
        const slice = hist.slice(-avgPeriod);
        const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
        const isSuper = body > avg * superMultiplier && c1.close !== c1.open;
        if (!isSuper) continue;

        const side: "long" | "short" = c1.close > c1.open ? "long" : "short";
        stats.momentumCandles++;
        if (side === "long") stats.bullishMomentum++; else stats.bearishMomentum++;

        const range = c1.high - c1.low;
        if (range <= 0) continue;

        // Fib levels per side spec
        const fib0 = side === "long" ? c1.high : c1.low;
        const fib02 = side === "long" ? c1.high - 0.2 * range : c1.low + 0.2 * range;
        const fib05 = side === "long" ? c1.high - 0.5 * range : c1.low + 0.5 * range;
        const fibNeg05 = side === "long" ? c1.high + 0.5 * range : c1.low - 0.5 * range;

        const trade: MFPTrade = {
          date, tf: cfg.tf, side,
          momentumTime: c1.time,
          c1High: c1.high, c1Low: c1.low,
          fib02, fib05, fibNeg05, entry: fib0,
          outcome: "no-pullback",
        };

        // Scan C2+ in same session until SL/TP or session close
        let pulledBack = false;
        let triggered = false;

        for (let j = i + 1; j < candles.length; j++) {
          const cn = candles[j];

          if (!pulledBack) {
            // Pullback check on C2+: a candle must touch fib 0.2 AND must not pre-fill the entry
            // (we want a clean pullback then breakout). If candle invalidates by hitting SL first, abort.
            const hitPullback = side === "long" ? cn.low <= fib02 : cn.high >= fib02;
            const hitSL = side === "long" ? cn.low <= fib05 : cn.high >= fib05;
            if (hitSL && !hitPullback) {
              trade.outcome = "no-pullback";
              break;
            }
            if (hitPullback) {
              pulledBack = true;
              trade.pullbackTime = cn.time;
              // Within same C2 bar, the buy/sell stop at fib 0 could also fire then resolve
              const hitEntry = side === "long" ? cn.high >= fib0 : cn.low <= fib0;
              if (hitEntry) {
                triggered = true;
                trade.triggerTime = cn.time;
                const hitTP = side === "long" ? cn.high >= fibNeg05 : cn.low <= fibNeg05;
                const hitSLNow = side === "long" ? cn.low <= fib05 : cn.high >= fib05;
                if (hitTP && hitSLNow) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
                if (hitTP) { trade.outcome = "win"; trade.resolvedTime = cn.time; break; }
                if (hitSLNow) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
              }
              continue;
            }
            continue;
          }

          // Already pulled back. Wait for entry, then resolve.
          if (!triggered) {
            const hitEntry = side === "long" ? cn.high >= fib0 : cn.low <= fib0;
            const hitSL = side === "long" ? cn.low <= fib05 : cn.high >= fib05;
            if (hitSL && !hitEntry) {
              trade.outcome = "no-trigger";
              break;
            }
            if (hitEntry) {
              triggered = true;
              trade.triggerTime = cn.time;
              const hitTP = side === "long" ? cn.high >= fibNeg05 : cn.low <= fibNeg05;
              const hitSLNow = side === "long" ? cn.low <= fib05 : cn.high >= fib05;
              if (hitTP && hitSLNow) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
              if (hitTP) { trade.outcome = "win"; trade.resolvedTime = cn.time; break; }
              if (hitSLNow) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
            }
            continue;
          }

          // Triggered, await resolution
          const hitTP = side === "long" ? cn.high >= fibNeg05 : cn.low <= fibNeg05;
          const hitSL = side === "long" ? cn.low <= fib05 : cn.high >= fib05;
          if (hitTP && hitSL) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
          if (hitTP) { trade.outcome = "win"; trade.resolvedTime = cn.time; break; }
          if (hitSL) { trade.outcome = "loss"; trade.resolvedTime = cn.time; break; }
        }

        if (pulledBack && trade.outcome === "no-pullback") trade.outcome = triggered ? "open" : "no-trigger";
        if (triggered && trade.outcome === "no-trigger") trade.outcome = "open";

        if (pulledBack) stats.pullbackHits++;
        if (triggered) {
          stats.triggered++;
          if (side === "long") stats.longTriggered++; else stats.shortTriggered++;
        }
        if (trade.outcome === "win") {
          stats.wins++;
          if (side === "long") stats.longWins++; else stats.shortWins++;
        } else if (trade.outcome === "loss") {
          stats.losses++;
          if (side === "long") stats.longLosses++; else stats.shortLosses++;
        } else if (trade.outcome === "open") {
          stats.open++;
        }
        trades.push(trade);
      }
    }
  }

  for (const tf of Object.keys(tfStats) as MFPTimeframe[]) {
    const s = tfStats[tf];
    const resolved = s.wins + s.losses;
    s.winRate = resolved > 0 ? (s.wins / resolved) * 100 : 0;
    s.pullbackRate = s.momentumCandles > 0 ? (s.pullbackHits / s.momentumCandles) * 100 : 0;
    s.triggerRate = s.momentumCandles > 0 ? (s.triggered / s.momentumCandles) * 100 : 0;
  }

  return { totalDays: dates.length, superMultiplier, avgPeriod, tfStats, trades };
}
