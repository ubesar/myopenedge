import { parse } from "date-fns";
import type { CandleBar } from "./m15-aggregation";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export const ORB_TARGETS = [0.5, 1, 1.5, 2, 3] as const;
export type ORBTargetR = (typeof ORB_TARGETS)[number];

export type ORBOutcome = "win" | "loss" | "eod";

export interface ORBTargetStats {
  targetR: ORBTargetR;
  total: number;
  wins: number;
  losses: number;
  eod: number;
  winRate: number;      // wins / (wins+losses)
  expectancyR: number;  // avg R over all breakout trades
  longWins: number; longLosses: number;
  shortWins: number; shortLosses: number;
}

export interface ORBRetest {
  time: string;
  minutes: number;      // minutes from breakout to retest
  mfePreR: number;      // max favourable excursion (in R) before the retest
  continuation: boolean;
}

export interface ORBDay {
  date: string;
  bars: CandleBar[];
  orHigh: number;
  orLow: number;
  orSize: number;
  orSizePct: number;
  direction: "long" | "short" | "none";
  breakoutTime?: string;
  entry?: number;
  stop?: number;
  mfeR: number;
  maeR: number;
  rAtClose: number;
  targets: Record<string, ORBOutcome>;
  retest?: ORBRetest;
}

export interface ORBQuintile {
  label: string;
  n: number;
  minPct: number;
  maxPct: number;
  breakoutRate: number;
  avgMfeR: number;
  avgMaeR: number;
  winRate1R: number;
}

export interface ORBRetestBucket {
  label: string;
  n: number;
  continuations: number;
  continuationRate: number;
  ciLow: number;
  ciHigh: number;
  avgMfePreR: number;
}

export interface ORBResult {
  totalDays: number;
  orMinutes: number;
  breakoutDays: number;
  noBreakoutDays: number;
  breakoutRate: number;
  longBreakouts: number;
  shortBreakouts: number;
  avgBreakoutMinute: number;    // minutes after OR end
  avgOrSizePct: number;
  targetStats: ORBTargetStats[];
  quintiles: ORBQuintile[];
  retestRate: number;
  retestDays: number;
  retestBuckets: ORBRetestBucket[];
  continuationRate: number;
  days: ORBDay[];
}

const SESSION_START = 9 * 60 + 30;
const SESSION_END = 16 * 60;

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - margin) / denom) * 100, Math.min(1, (centre + margin) / denom) * 100];
}

const RETEST_BUCKETS: { label: string; max: number }[] = [
  { label: "0–5 min", max: 5 },
  { label: "5–10 min", max: 10 },
  { label: "10–20 min", max: 20 },
  { label: "20–45 min", max: 45 },
  { label: "45–60 min", max: 60 },
  { label: "> 60 min", max: Infinity },
];

/**
 * Opening Range Breakout analysis.
 *
 * - Opening range = 09:30 → 09:30 + orMinutes (ET).
 * - Entry on the first bar that trades beyond the OR high (long) or OR low (short).
 * - Stop = opposite OR extreme, so 1R == 1 × opening-range size.
 * - Targets are evaluated in parallel (0.5R … 3R); unresolved by 16:00 → exit at close.
 * - Retest = price returning to the breakout level after the breakout bar; a
 *   continuation means price then exceeds the pre-retest extreme before the stop.
 */
export function analyzeORB(
  bars: BarData[],
  orMinutes: number = 15,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5],
): ORBResult {
  const orEnd = SESSION_START + orMinutes;

  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter((d) => weekdays.includes(new Date(d + "T12:00:00").getDay()));

  const days: ORBDay[] = [];

  for (const date of dates) {
    const raw = byDate.get(date)!
      .map((b) => ({
        d: parseDateTime(b.datetime),
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

    if (raw.length === 0) continue;

    const orBars = raw.filter((b) => minutesOf(b.d) < orEnd);
    const postBars = raw.filter((b) => minutesOf(b.d) >= orEnd);
    if (orBars.length === 0 || postBars.length === 0) continue;

    const orHigh = Math.max(...orBars.map((b) => b.high));
    const orLow = Math.min(...orBars.map((b) => b.low));
    const orSize = orHigh - orLow;
    if (orSize <= 0) continue;

    const chartBars: CandleBar[] = raw.map((b) => ({
      time: hhmm(b.d), open: b.open, high: b.high, low: b.low, close: b.close,
    }));

    const day: ORBDay = {
      date,
      bars: chartBars,
      orHigh, orLow, orSize,
      orSizePct: (orSize / orLow) * 100,
      direction: "none",
      mfeR: 0, maeR: 0, rAtClose: 0,
      targets: {},
    };

    // find first breakout
    let bIdx = -1;
    for (let i = 0; i < postBars.length; i++) {
      const b = postBars[i];
      const up = b.high > orHigh;
      const down = b.low < orLow;
      if (up && down) {
        day.direction = b.close >= b.open ? "long" : "short";
        bIdx = i; break;
      }
      if (up) { day.direction = "long"; bIdx = i; break; }
      if (down) { day.direction = "short"; bIdx = i; break; }
    }

    if (bIdx === -1) { days.push(day); continue; }

    const isLong = day.direction === "long";
    const entry = isLong ? orHigh : orLow;
    const stop = isLong ? orLow : orHigh;
    const risk = orSize;
    day.entry = entry;
    day.stop = stop;
    day.breakoutTime = hhmm(postBars[bIdx].d);

    const path = postBars.slice(bIdx);

    // excursions
    let mfeR = 0, maeR = 0;
    for (const b of path) {
      const fav = isLong ? b.high - entry : entry - b.low;
      const adv = isLong ? entry - b.low : b.high - entry;
      mfeR = Math.max(mfeR, fav / risk);
      maeR = Math.max(maeR, adv / risk);
    }
    day.mfeR = mfeR;
    day.maeR = maeR;
    const lastClose = path[path.length - 1].close;
    day.rAtClose = (isLong ? lastClose - entry : entry - lastClose) / risk;

    // targets
    for (const t of ORB_TARGETS) {
      const tp = isLong ? entry + t * risk : entry - t * risk;
      let outcome: ORBOutcome = "eod";
      for (const b of path) {
        const hitTp = isLong ? b.high >= tp : b.low <= tp;
        const hitSl = isLong ? b.low <= stop : b.high >= stop;
        if (hitTp && hitSl) { outcome = "loss"; break; }   // conservative: stop first
        if (hitTp) { outcome = "win"; break; }
        if (hitSl) { outcome = "loss"; break; }
      }
      day.targets[String(t)] = outcome;
    }

    // retest — price returns to the breakout level after the breakout bar
    const breakoutMinute = minutesOf(path[0].d);
    let preExtreme = isLong ? path[0].high : path[0].low;
    for (let i = 1; i < path.length; i++) {
      const b = path[i];
      const back = isLong ? b.low <= entry : b.high >= entry;
      const stopped = isLong ? b.low <= stop : b.high >= stop;
      if (stopped && !back) break;
      if (back) {
        const mins = minutesOf(b.d) - breakoutMinute;
        const mfePreR = (isLong ? preExtreme - entry : entry - preExtreme) / risk;
        // continuation: exceeds the pre-retest extreme before hitting the stop
        let continuation = false;
        for (let j = i + 1; j < path.length; j++) {
          const c = path[j];
          const beyond = isLong ? c.high > preExtreme : c.low < preExtreme;
          const dead = isLong ? c.low <= stop : c.high >= stop;
          if (beyond) { continuation = true; break; }
          if (dead) break;
        }
        day.retest = { time: hhmm(b.d), minutes: mins, mfePreR, continuation };
        break;
      }
      preExtreme = isLong ? Math.max(preExtreme, b.high) : Math.min(preExtreme, b.low);
    }

    days.push(day);
  }

  const breakoutDays = days.filter((d) => d.direction !== "none");
  const totalDays = days.length;

  // per-target stats
  const targetStats: ORBTargetStats[] = ORB_TARGETS.map((t) => {
    const key = String(t);
    let wins = 0, losses = 0, eod = 0, longWins = 0, longLosses = 0, shortWins = 0, shortLosses = 0, sumR = 0;
    for (const d of breakoutDays) {
      const o = d.targets[key];
      if (o === "win") {
        wins++; sumR += t;
        if (d.direction === "long") longWins++; else shortWins++;
      } else if (o === "loss") {
        losses++; sumR -= 1;
        if (d.direction === "long") longLosses++; else shortLosses++;
      } else {
        eod++; sumR += d.rAtClose;
      }
    }
    const resolved = wins + losses;
    return {
      targetR: t,
      total: breakoutDays.length,
      wins, losses, eod,
      winRate: resolved > 0 ? (wins / resolved) * 100 : 0,
      expectancyR: breakoutDays.length > 0 ? sumR / breakoutDays.length : 0,
      longWins, longLosses, shortWins, shortLosses,
    };
  });

  // OR size quintiles (across all days that had a valid opening range)
  const sortedBySize = [...days].sort((a, b) => a.orSizePct - b.orSizePct);
  const quintiles: ORBQuintile[] = [];
  const q = Math.floor(sortedBySize.length / 5);
  if (q > 0) {
    for (let i = 0; i < 5; i++) {
      const slice = i === 4 ? sortedBySize.slice(i * q) : sortedBySize.slice(i * q, (i + 1) * q);
      const bo = slice.filter((d) => d.direction !== "none");
      const res1R = bo.filter((d) => d.targets["1"] === "win" || d.targets["1"] === "loss");
      quintiles.push({
        label: `Q${i + 1}`,
        n: slice.length,
        minPct: slice.length ? slice[0].orSizePct : 0,
        maxPct: slice.length ? slice[slice.length - 1].orSizePct : 0,
        breakoutRate: slice.length ? (bo.length / slice.length) * 100 : 0,
        avgMfeR: bo.length ? bo.reduce((a, d) => a + d.mfeR, 0) / bo.length : 0,
        avgMaeR: bo.length ? bo.reduce((a, d) => a + d.maeR, 0) / bo.length : 0,
        winRate1R: res1R.length ? (res1R.filter((d) => d.targets["1"] === "win").length / res1R.length) * 100 : 0,
      });
    }
  }

  // retest buckets
  const retestDays = breakoutDays.filter((d) => d.retest);
  const retestBuckets: ORBRetestBucket[] = RETEST_BUCKETS.map((b, idx) => {
    const min = idx === 0 ? -1 : RETEST_BUCKETS[idx - 1].max;
    const rows = retestDays.filter((d) => d.retest!.minutes > min && d.retest!.minutes <= b.max);
    const cont = rows.filter((d) => d.retest!.continuation).length;
    const [ciLow, ciHigh] = wilson(cont, rows.length);
    return {
      label: b.label,
      n: rows.length,
      continuations: cont,
      continuationRate: rows.length ? (cont / rows.length) * 100 : 0,
      ciLow, ciHigh,
      avgMfePreR: rows.length ? rows.reduce((a, d) => a + d.retest!.mfePreR, 0) / rows.length : 0,
    };
  });

  const breakoutMinutes = breakoutDays
    .map((d) => (d.breakoutTime ? Number(d.breakoutTime.split(":")[0]) * 60 + Number(d.breakoutTime.split(":")[1]) - orEnd : 0));

  return {
    totalDays,
    orMinutes,
    breakoutDays: breakoutDays.length,
    noBreakoutDays: totalDays - breakoutDays.length,
    breakoutRate: totalDays ? (breakoutDays.length / totalDays) * 100 : 0,
    longBreakouts: breakoutDays.filter((d) => d.direction === "long").length,
    shortBreakouts: breakoutDays.filter((d) => d.direction === "short").length,
    avgBreakoutMinute: breakoutMinutes.length ? breakoutMinutes.reduce((a, b) => a + b, 0) / breakoutMinutes.length : 0,
    avgOrSizePct: totalDays ? days.reduce((a, d) => a + d.orSizePct, 0) / totalDays : 0,
    targetStats,
    quintiles,
    retestRate: breakoutDays.length ? (retestDays.length / breakoutDays.length) * 100 : 0,
    retestDays: retestDays.length,
    retestBuckets,
    continuationRate: retestDays.length
      ? (retestDays.filter((d) => d.retest!.continuation).length / retestDays.length) * 100
      : 0,
    days,
  };
}

/** Convert an ORB result into generic quant trades at a given target. */
export function orbQuantTrades(result: ORBResult, targetR: number = 1) {
  return result.days
    .filter((d) => d.direction !== "none" && d.entry != null)
    .map((d) => {
      const o = d.targets[String(targetR)];
      const isLong = d.direction === "long";
      const exit = o === "win"
        ? (isLong ? d.entry! + targetR * d.orSize : d.entry! - targetR * d.orSize)
        : o === "loss"
        ? d.stop!
        : undefined;
      const rMultiple = o === "win" ? targetR : o === "loss" ? -1 : d.rAtClose;
      return {
        date: d.date,
        side: (isLong ? "long" : "short") as "long" | "short",
        entry: d.entry!,
        exit,
        risk: d.orSize,
        outcome: (rMultiple > 0 ? "win" : "loss") as "win" | "loss",
        rMultiple,
      };
    });
}
