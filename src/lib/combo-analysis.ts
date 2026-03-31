import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";
import { computeBBSeries, type BBBar } from "./bollinger-bands";

/* ─── Types ─── */

export interface IBCondition {
  type: "ib_breakout";
  window: 30 | 60;
  direction: "high" | "low" | "any";
}

export interface BBCondition {
  type: "bb_breakout";
  timeframe: 5 | 15 | 30;
  band: "upper" | "lower";
  period: number;
  timing: "during_ib" | "after_ib" | "morning";
}

export interface MCCondition {
  type: "momentum_candle";
  bodyRatio: number;
  direction: "bullish" | "bearish" | "any";
  timing: "during_ib" | "after_ib" | "morning";
}

export interface OCCCondition {
  type: "occ";
  timeframe: 15 | 30;
  direction: "green" | "red" | "any";
}

export type ConditionConfig = IBCondition | BBCondition | MCCondition | OCCCondition;

export interface DayDetail {
  date: string;
  condAFired: boolean;
  condADirection: "bullish" | "bearish" | null;
  condBFired: boolean;
  condBDirection: "bullish" | "bearish" | null;
  bothFired: boolean;
  continuation: boolean;
  dayClose: number;
  ibHigh: number;
  ibLow: number;
}

export interface ComboResult {
  totalDays: number;
  condAFired: number;
  condBFired: number;
  bothFired: number;
  continuation: number;
  continuationPct: number;
  reversalPct: number;
  avgContinuationSize: number;
  details: DayDetail[];
}

/* ─── Helpers ─── */

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
function getTimeMin(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30; // 09:30
const MORNING_END = 12 * 60;  // 12:00
const MARKET_CLOSE = 16 * 60; // 16:00

function getTimingRange(
  timing: "during_ib" | "after_ib" | "morning",
  ibEnd: number
): [number, number] {
  switch (timing) {
    case "during_ib": return [IB_START, ibEnd];
    case "after_ib": return [ibEnd, MARKET_CLOSE];
    case "morning": return [IB_START, MORNING_END];
  }
}

/* ─── Condition Checkers ─── */

function checkIBBreakout(
  dayBars5m: CandleBar[],
  cond: IBCondition
): { fired: boolean; direction: "bullish" | "bearish" | null } {
  const ibEnd = IB_START + cond.window;

  const ibBars = dayBars5m.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    const t = h * 60 + m;
    return t >= IB_START && t < ibEnd;
  });
  if (ibBars.length < 2) return { fired: false, direction: null };

  const ibHigh = Math.max(...ibBars.map((b) => b.high));
  const ibLow = Math.min(...ibBars.map((b) => b.low));

  const postIBBars = dayBars5m.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    const t = h * 60 + m;
    return t >= ibEnd && t < MARKET_CLOSE;
  });

  let brokeHigh = false;
  let brokeLow = false;
  for (const bar of postIBBars) {
    if (bar.close > ibHigh) brokeHigh = true;
    if (bar.close < ibLow) brokeLow = true;
  }

  if (cond.direction === "high" && brokeHigh) return { fired: true, direction: "bullish" };
  if (cond.direction === "low" && brokeLow) return { fired: true, direction: "bearish" };
  if (cond.direction === "any") {
    if (brokeHigh && !brokeLow) return { fired: true, direction: "bullish" };
    if (brokeLow && !brokeHigh) return { fired: true, direction: "bearish" };
    if (brokeHigh && brokeLow) return { fired: true, direction: "bullish" }; // first break
  }

  return { fired: false, direction: null };
}

function checkBBBreakout(
  dayBBBars: BBBar[],
  cond: BBCondition,
  ibWindow: number
): { fired: boolean; direction: "bullish" | "bearish" | null } {
  const ibEnd = IB_START + ibWindow;
  const [rangeStart, rangeEnd] = getTimingRange(cond.timing, ibEnd);

  const barsInRange = dayBBBars.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    const t = h * 60 + m;
    return t >= rangeStart && t < rangeEnd && b.bb !== null;
  });

  for (const bar of barsInRange) {
    if (!bar.bb) continue;
    if (cond.band === "upper" && bar.close > bar.bb.upper) {
      return { fired: true, direction: "bullish" };
    }
    if (cond.band === "lower" && bar.close < bar.bb.lower) {
      return { fired: true, direction: "bearish" };
    }
  }

  return { fired: false, direction: null };
}

function checkMomentumCandle(
  dayBars5m: CandleBar[],
  cond: MCCondition,
  ibWindow: number
): { fired: boolean; direction: "bullish" | "bearish" | null } {
  const ibEnd = IB_START + ibWindow;
  const [rangeStart, rangeEnd] = getTimingRange(cond.timing, ibEnd);

  const barsInRange = dayBars5m.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    const t = h * 60 + m;
    return t >= rangeStart && t < rangeEnd;
  });

  for (const bar of barsInRange) {
    const body = Math.abs(bar.close - bar.open);
    const range = bar.high - bar.low;
    if (range <= 0) continue;
    const ratio = body / range;
    if (ratio < cond.bodyRatio) continue;

    const isBullish = bar.close > bar.open;
    if (cond.direction === "bullish" && isBullish) return { fired: true, direction: "bullish" };
    if (cond.direction === "bearish" && !isBullish) return { fired: true, direction: "bearish" };
    if (cond.direction === "any") return { fired: true, direction: isBullish ? "bullish" : "bearish" };
  }

  return { fired: false, direction: null };
}

function checkOCC(
  dayBars5m: CandleBar[],
  cond: OCCCondition
): { fired: boolean; direction: "bullish" | "bearish" | null } {
  // Aggregate to the OCC timeframe
  const rthBars = dayBars5m.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    return h * 60 + m >= IB_START && h * 60 + m < MARKET_CLOSE;
  });

  const aggBars = aggregateBars(rthBars, cond.timeframe);
  if (aggBars.length === 0) return { fired: false, direction: null };

  const firstCandle = aggBars[0];
  const isGreen = firstCandle.close > firstCandle.open;

  if (cond.direction === "green" && isGreen) return { fired: true, direction: "bullish" };
  if (cond.direction === "red" && !isGreen) return { fired: true, direction: "bearish" };
  if (cond.direction === "any") return { fired: true, direction: isGreen ? "bullish" : "bearish" };

  return { fired: false, direction: null };
}

/* ─── Main Analysis ─── */

export function analyzeCombo(
  rawBars: BarData[],
  condA: ConditionConfig,
  condB: ConditionConfig,
  maxDays: number = 60,
  weekdays: number[] = [1, 2, 3, 4, 5]
): ComboResult {
  // Parse all bars to CandleBar with date info
  const parsed: Array<{ date: string; bar: CandleBar }> = [];
  for (const b of rawBars) {
    const dt = parseDateTime(b.datetime);
    const tMin = getTimeMin(dt);
    if (tMin < IB_START || tMin >= MARKET_CLOSE) continue;

    parsed.push({
      date: b.datetime.split(" ")[0],
      bar: {
        time: b.datetime.split(" ")[1].slice(0, 5),
        open: parseFloat(b.open),
        high: parseFloat(b.high),
        low: parseFloat(b.low),
        close: parseFloat(b.close),
      },
    });
  }

  // Group by date
  const byDate = new Map<string, CandleBar[]>();
  for (const { date, bar } of parsed) {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  dates = dates.filter((d) => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });
  if (maxDays > 0) dates = dates.slice(-maxDays);

  // For BB conditions, precompute BB series across ALL bars
  const ibWindowForBB = condA.type === "ib_breakout" ? condA.window : (condB.type === "ib_breakout" ? condB.window : 60);

  // Determine BB timeframe if either condition is BB
  let bbTimeframe = 15;
  let bbPeriod = 20;
  if (condA.type === "bb_breakout") { bbTimeframe = condA.timeframe; bbPeriod = condA.period; }
  if (condB.type === "bb_breakout") { bbTimeframe = condB.timeframe; bbPeriod = condB.period; }

  // Aggregate all RTH bars for BB computation
  const allRTHBars = dates.flatMap((d) => {
    const bars = byDate.get(d) || [];
    return bars.map((b) => ({ ...b, _date: d }));
  });

  const aggBars = aggregateBars(
    allRTHBars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })),
    bbTimeframe
  );
  const bbSeries = computeBBSeries(aggBars, bbPeriod, 2);

  // Map BB bars back to dates (approximate by time pattern reset)
  const bbByDate = new Map<string, BBBar[]>();
  let bbIdx = 0;
  for (const date of dates) {
    const dayBars5m = byDate.get(date) || [];
    const dayAgg = aggregateBars(dayBars5m, bbTimeframe);
    const dayBB: BBBar[] = [];
    for (let j = 0; j < dayAgg.length; j++) {
      if (bbIdx < bbSeries.length) {
        dayBB.push(bbSeries[bbIdx]);
        bbIdx++;
      }
    }
    bbByDate.set(date, dayBB);
  }

  // Analyze each day
  const details: DayDetail[] = [];

  for (const date of dates) {
    const dayBars5m = byDate.get(date)!;
    if (dayBars5m.length < 6) continue;

    const dayBBBars = bbByDate.get(date) || [];
    const dayClose = dayBars5m[dayBars5m.length - 1].close;

    // Get IB range for continuation measurement
    const ibW = ibWindowForBB;
    const ibEnd = IB_START + ibW;
    const ibBars = dayBars5m.filter((b) => {
      const [h, m] = b.time.split(":").map(Number);
      return h * 60 + m >= IB_START && h * 60 + m < ibEnd;
    });
    const ibHigh = ibBars.length > 0 ? Math.max(...ibBars.map((b) => b.high)) : 0;
    const ibLow = ibBars.length > 0 ? Math.min(...ibBars.map((b) => b.low)) : 0;

    // Check conditions
    const resA = checkCondition(condA, dayBars5m, dayBBBars, ibW);
    const resB = checkCondition(condB, dayBars5m, dayBBBars, ibW);

    const bothFired = resA.fired && resB.fired;

    // Continuation: both signals agree on direction and close confirms
    let continuation = false;
    if (bothFired && resA.direction && resB.direction) {
      if (resA.direction === resB.direction) {
        continuation = resA.direction === "bullish" ? dayClose > ibHigh : dayClose < ibLow;
      }
    }
    // If directions differ, we consider continuation when the dominant one works
    if (bothFired && resA.direction && resB.direction && resA.direction !== resB.direction) {
      // Use condition A's direction as primary
      continuation = resA.direction === "bullish" ? dayClose > ibHigh : dayClose < ibLow;
    }

    details.push({
      date,
      condAFired: resA.fired,
      condADirection: resA.direction,
      condBFired: resB.fired,
      condBDirection: resB.direction,
      bothFired,
      continuation,
      dayClose,
      ibHigh,
      ibLow,
    });
  }

  const bothFiredDays = details.filter((d) => d.bothFired);
  const continuationDays = bothFiredDays.filter((d) => d.continuation);

  // Avg continuation size (in points, relative to IB range)
  let avgContSize = 0;
  if (continuationDays.length > 0) {
    const sizes = continuationDays.map((d) => {
      const ibRange = d.ibHigh - d.ibLow;
      if (ibRange <= 0) return 0;
      const move = d.condADirection === "bullish"
        ? (d.dayClose - d.ibHigh) / ibRange
        : (d.ibLow - d.dayClose) / ibRange;
      return Math.max(0, move);
    });
    avgContSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  }

  return {
    totalDays: details.length,
    condAFired: details.filter((d) => d.condAFired).length,
    condBFired: details.filter((d) => d.condBFired).length,
    bothFired: bothFiredDays.length,
    continuation: continuationDays.length,
    continuationPct: bothFiredDays.length > 0 ? (continuationDays.length / bothFiredDays.length) * 100 : 0,
    reversalPct: bothFiredDays.length > 0 ? ((bothFiredDays.length - continuationDays.length) / bothFiredDays.length) * 100 : 0,
    avgContinuationSize: avgContSize,
    details,
  };
}

function checkCondition(
  cond: ConditionConfig,
  dayBars5m: CandleBar[],
  dayBBBars: BBBar[],
  ibWindow: number
): { fired: boolean; direction: "bullish" | "bearish" | null } {
  switch (cond.type) {
    case "ib_breakout": return checkIBBreakout(dayBars5m, cond);
    case "bb_breakout": return checkBBBreakout(dayBBBars, cond, ibWindow);
    case "momentum_candle": return checkMomentumCandle(dayBars5m, cond, ibWindow);
    case "occ": return checkOCC(dayBars5m, cond);
  }
}
