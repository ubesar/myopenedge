import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type TradeOutcome = "win" | "loss" | "open";

export interface PullbackTrade {
  date: string;
  triggerTime: string;
  resolvedTime?: string;
  direction: "bullish" | "bearish";
  entry: number;
  stop: number;
  target: number;
  bodyRatio: number;
  rangePts: number;
  outcome: TradeOutcome;
}

export interface PullbackSideStats {
  total: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number;
}

export interface PullbackResult {
  totalDays: number;
  totalTrades: number;
  bullish: PullbackSideStats;
  bearish: PullbackSideStats;
  overall: PullbackSideStats;
  trades: PullbackTrade[];
  params: {
    bodyThreshold: number;
    pullbackLevel: number;
    tp1Ratio: number;
    sessionEndMinutes: number;
    stopMode: "full" | "half";
  };
}

export interface PullbackOptions {
  bodyThreshold?: number;        // default 0.7 (fallback only when not enough history for super-body)
  pullbackLevel?: number;        // default 0.5
  tp1Ratio?: number;             // default 0.5  (RR 1:1)
  sessionEndMinutes?: number;    // default 780  (13:00 NY)
  stopMode?: "full" | "half";    // default "full"
  triggerLookahead?: number;     // default 2 (candle 2 & 3)
  /** super-body multiplier vs SMA(body, avgPeriod). default 1.5 (Pine "Super/Solid Body Candle") */
  superMultiplier?: number;
  /** lookback period for SMA(body). default 15 */
  avgPeriod?: number;
  maxDays?: number;
  weekdays?: number[];           // default [1..5]
}

const RTH_START = 9 * 60 + 30; // 09:30
const RTH_END = 16 * 60;       // 16:00

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function emptySide(): PullbackSideStats {
  return { total: 0, wins: 0, losses: 0, open: 0, winRate: 0 };
}

function finalizeSide(s: PullbackSideStats): PullbackSideStats {
  const resolved = s.wins + s.losses;
  s.winRate = resolved > 0 ? (s.wins / resolved) * 100 : 0;
  return s;
}

export function analyzePullback(bars: BarData[], options: PullbackOptions = {}): PullbackResult {
  const bodyThreshold = options.bodyThreshold ?? 0.7;
  const pullbackLevel = options.pullbackLevel ?? 0.5;
  const tp1Ratio = options.tp1Ratio ?? 0.5;
  const sessionEndMinutes = options.sessionEndMinutes ?? 780;
  const stopMode = options.stopMode ?? "full";
  const superMultiplier = options.superMultiplier ?? 1.5;
  const avgPeriod = options.avgPeriod ?? 15;
  const maxDays = options.maxDays ?? 0;
  const weekdays = options.weekdays ?? [1, 2, 3, 4, 5];

  // Rolling history of M15 body sizes across all sessions (Pine: ta.sma(BodyRange(), 15))
  const bodyHistory: number[] = [];

  // Group bars by date
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter(d => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  const trades: PullbackTrade[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Filter RTH session bars
    const sessionRaw = dayBars.filter(b => {
      const dt = parseDateTime(b.datetime);
      const m = dt.getHours() * 60 + dt.getMinutes();
      return m >= RTH_START && m < RTH_END;
    });
    if (sessionRaw.length === 0) continue;

    const sessionBars5min: CandleBar[] = sessionRaw.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    // Aggregate to M15
    const m15 = aggregateBars(sessionBars5min, 15);
    if (m15.length < 2) continue;

    let openUntilIndex = -1; // gating

    for (let i = 0; i < m15.length - 1; i++) {
      if (i <= openUntilIndex) continue;

      const c = m15[i];
      const tMin = timeToMinutes(c.time);
      if (tMin >= sessionEndMinutes) break;

      const range = c.high - c.low;
      if (range <= 0) continue;
      const body = Math.abs(c.close - c.open);
      const ratio = body / range;
      if (ratio < bodyThreshold) continue;
      if (c.close === c.open) continue;

      const direction: "bullish" | "bearish" = c.close > c.open ? "bullish" : "bearish";
      const mid = direction === "bullish"
        ? c.low + range * pullbackLevel
        : c.high - range * pullbackLevel;

      // Trigger window: try candle i+1 .. i+triggerLookahead (default 2 → candle 2 & 3).
      // If an intermediate candle does not trigger AND is itself a momentum candle,
      // invalidate the current trigger so the outer loop promotes that candle.
      const triggerLookahead = options.triggerLookahead ?? 2;
      let triggerIdx = -1;
      for (let k = 1; k <= triggerLookahead && i + k < m15.length; k++) {
        const nb = m15[i + k];
        if (timeToMinutes(nb.time) >= RTH_END) break;
        const tagged = direction === "bullish" ? nb.low <= mid : nb.high >= mid;
        if (tagged) { triggerIdx = i + k; break; }
        const nbRange = nb.high - nb.low;
        if (nbRange > 0) {
          const nbRatio = Math.abs(nb.close - nb.open) / nbRange;
          if (nbRatio >= bodyThreshold && nb.close !== nb.open) break; // invalidated
        }
      }
      if (triggerIdx === -1) continue;

      const entry = mid;
      const fullStop = direction === "bullish" ? c.low : c.high;
      const halfStop = direction === "bullish"
        ? c.low + range * pullbackLevel * 0.5
        : c.high - range * pullbackLevel * 0.5;
      const stop = stopMode === "full" ? fullStop : halfStop;
      const riskPerShare = Math.abs(entry - stop);
      if (riskPerShare <= 0) continue;

      const target = direction === "bullish"
        ? entry + range * tp1Ratio
        : entry - range * tp1Ratio;

      // Walk-forward from trigger candle to end of session (< 16:00)
      let outcome: TradeOutcome = "open";
      let resolvedTime: string | undefined;
      for (let j = triggerIdx; j < m15.length; j++) {
        const b = m15[j];
        if (timeToMinutes(b.time) >= RTH_END) break;
        let hitStop = false;
        let hitTarget = false;
        if (direction === "bullish") {
          hitStop = b.low <= stop;
          hitTarget = b.high >= target;
        } else {
          hitStop = b.high >= stop;
          hitTarget = b.low <= target;
        }
        if (hitStop && hitTarget) { outcome = "loss"; resolvedTime = b.time; break; }
        if (hitTarget) { outcome = "win"; resolvedTime = b.time; break; }
        if (hitStop) { outcome = "loss"; resolvedTime = b.time; break; }
      }

      // Gating: block new entries until trade resolves
      if (outcome !== "open" && resolvedTime) {
        const resolvedIdx = m15.findIndex(b => b.time === resolvedTime);
        openUntilIndex = resolvedIdx >= 0 ? resolvedIdx : m15.length;
      } else {
        openUntilIndex = m15.length;
      }

      trades.push({
        date,
        triggerTime: c.time,
        resolvedTime,
        direction,
        entry,
        stop,
        target,
        bodyRatio: ratio,
        rangePts: range,
        outcome,
      });
    }
  }

  // Aggregate stats
  const bullish = emptySide();
  const bearish = emptySide();
  const overall = emptySide();

  const tally = (stats: PullbackSideStats, t: PullbackTrade) => {
    stats.total++;
    if (t.outcome === "win") stats.wins++;
    else if (t.outcome === "loss") stats.losses++;
    else stats.open++;
  };

  for (const t of trades) {
    tally(overall, t);
    tally(t.direction === "bullish" ? bullish : bearish, t);
  }

  [overall, bullish, bearish].forEach(s => finalizeSide(s));

  return {
    totalDays: dates.length,
    totalTrades: trades.length,
    bullish,
    bearish,
    overall,
    trades,
    params: { bodyThreshold, pullbackLevel, tp1Ratio, sessionEndMinutes, stopMode },
  };
}
