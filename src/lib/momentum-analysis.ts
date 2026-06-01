import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";

export type { CandleBar };

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

// Legacy type kept for backwards compat with old chart components
export interface MomentumSignal {
  type: "bullish" | "bearish";
  times: [string, string];
}

export type TradeDirection = "bullish" | "bearish";
export type TradeOutcome = "win" | "loss" | "open";

export interface MomentumTrade {
  date: string;
  entryTime: string;
  direction: TradeDirection;
  entry: number;
  range: number;
  slFull: number;
  slHalf: number;
  tp50: number;
  // Outcomes per SL variant against TP 50%
  fullSl_tp50: TradeOutcome;
  halfSl_tp50: TradeOutcome;
  resolvedAt: number; // index of bar that resolved gating (SL full + TP100)
}

export interface DirStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface TpStats {
  total: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number;
  bullish: DirStats;
  bearish: DirStats;
}

export interface MomentumResult {
  totalDays: number;
  daysWithSignal: number;
  sessionEndMinutes: number;
  bodyThreshold: number;
  totalTrades: number;
  fullSl: { tp50: TpStats };
  halfSl: { tp50: TpStats };
  trades: MomentumTrade[];
  // legacy compat (unused by new UI)
  bodyRatioThreshold: number;
  tfStats: Record<string, unknown>;
  lastDay: null;
}

const IB_START = 9 * 60 + 30; // 09:30 NY
const MARKET_CLOSE = 16 * 60; // 16:00 NY
const BODY_THRESHOLD = 0.7;
const TF_MINUTES = 15;

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

function emptyDir(): DirStats {
  return { total: 0, wins: 0, losses: 0, winRate: 0 };
}
function emptyTp(): TpStats {
  return { total: 0, wins: 0, losses: 0, open: 0, winRate: 0, bullish: emptyDir(), bearish: emptyDir() };
}
function finalizeDir(d: DirStats) {
  const denom = d.wins + d.losses;
  d.winRate = denom > 0 ? (d.wins / denom) * 100 : 0;
}
function finalizeTp(s: TpStats) {
  const denom = s.wins + s.losses;
  s.winRate = denom > 0 ? (s.wins / denom) * 100 : 0;
  finalizeDir(s.bullish);
  finalizeDir(s.bearish);
}

/**
 * Walk forward from `startIdx+1` to end of session, resolving outcome
 * for a given (stop, target) pair. Conservative: if both hit in same bar -> loss.
 */
function resolveOutcome(
  bars: CandleBar[],
  startIdx: number,
  direction: TradeDirection,
  stop: number,
  target: number,
): { outcome: TradeOutcome; resolvedIdx: number } {
  for (let i = startIdx + 1; i < bars.length; i++) {
    const b = bars[i];
    let hitStop: boolean;
    let hitTarget: boolean;
    if (direction === "bullish") {
      hitStop = b.low <= stop;
      hitTarget = b.high >= target;
    } else {
      hitStop = b.high >= stop;
      hitTarget = b.low <= target;
    }
    if (hitStop && hitTarget) return { outcome: "loss", resolvedIdx: i };
    if (hitTarget) return { outcome: "win", resolvedIdx: i };
    if (hitStop) return { outcome: "loss", resolvedIdx: i };
  }
  return { outcome: "open", resolvedIdx: bars.length - 1 };
}

export function analyzeMomentum(
  bars: BarData[],
  _ibWindowMinutes: number = 30,
  maxDays: number = 0,
  _bodyRatio: number = BODY_THRESHOLD,
  weekdays: number[] = [1, 2, 3, 4, 5],
  sessionEndMinutes: number = 13 * 60,
): MomentumResult {
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

  const trades: MomentumTrade[] = [];
  let daysWithSignal = 0;
  let totalDays = 0;

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const sessionRaw = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (sessionRaw.length === 0) continue;

    const m5: CandleBar[] = sessionRaw.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const m15 = aggregateBars(m5, TF_MINUTES);
    if (m15.length < 2) continue;
    totalDays++;

    let signalsToday = 0;
    let gateUntil = -1;

    for (let i = 0; i < m15.length - 1; i++) {
      if (i <= gateUntil) continue;
      const c = m15[i];
      const [hh, mm] = c.time.split(":").map(Number);
      const tMin = hh * 60 + mm;
      if (tMin < IB_START || tMin >= sessionEndMinutes) continue;

      const range = c.high - c.low;
      if (range <= 0) continue;
      const body = Math.abs(c.close - c.open);
      if (c.close === c.open) continue;
      if (body / range < BODY_THRESHOLD) continue;

      const direction: TradeDirection = c.close > c.open ? "bullish" : "bearish";
      const entry = c.close;
      const slFull = direction === "bullish" ? c.low : c.high;
      const slHalf = direction === "bullish" ? entry - range * 0.5 : entry + range * 0.5;
      const tp50 = direction === "bullish" ? entry + range * 0.5 : entry - range * 0.5;
      const tp100Gate = direction === "bullish" ? entry + range : entry - range;

      const full50 = resolveOutcome(m15, i, direction, slFull, tp50);
      const half50 = resolveOutcome(m15, i, direction, slHalf, tp50);
      const gate = resolveOutcome(m15, i, direction, slFull, tp100Gate);

      trades.push({
        date,
        entryTime: c.time,
        direction,
        entry,
        range,
        slFull,
        slHalf,
        tp50,
        fullSl_tp50: full50.outcome,
        halfSl_tp50: half50.outcome,
        resolvedAt: gate.resolvedIdx,
      });

      signalsToday++;
      gateUntil = gate.resolvedIdx;
    }

    if (signalsToday > 0) daysWithSignal++;
  }

  const fullTp50 = emptyTp();
  const halfTp50 = emptyTp();

  const tally = (tp: TpStats, dir: TradeDirection, outcome: TradeOutcome) => {
    tp.total++;
    const dirBucket = dir === "bullish" ? tp.bullish : tp.bearish;
    dirBucket.total++;
    if (outcome === "win") { tp.wins++; dirBucket.wins++; }
    else if (outcome === "loss") { tp.losses++; dirBucket.losses++; }
    else { tp.open++; }
  };

  for (const t of trades) {
    tally(fullTp50, t.direction, t.fullSl_tp50);
    tally(halfTp50, t.direction, t.halfSl_tp50);
  }
  finalizeTp(fullTp50);
  finalizeTp(halfTp50);

  return {
    totalDays,
    daysWithSignal,
    sessionEndMinutes,
    bodyThreshold: BODY_THRESHOLD,
    totalTrades: trades.length,
    fullSl: { tp50: fullTp50 },
    halfSl: { tp50: halfTp50 },
    trades,
    bodyRatioThreshold: BODY_THRESHOLD,
    tfStats: {},
    lastDay: null,
  };
}
