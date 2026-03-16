import { parse } from "date-fns";
import type { CandleBar } from "./m15-aggregation";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type GapDirection = "up" | "down";

/** Edgeful-style granular gap size buckets */
export type GapSizeBucket =
  | "0-0.19"
  | "0.2-0.39"
  | "0.4-0.69"
  | "0.7-0.99"
  | "1.0-1.49"
  | ">=1.5";

export const GAP_SIZE_BUCKETS: { key: GapSizeBucket; label: string; min: number; max: number }[] = [
  { key: "0-0.19", label: "0 – 0.19%", min: 0, max: 0.19 },
  { key: "0.2-0.39", label: "0.2 – 0.39%", min: 0.2, max: 0.39 },
  { key: "0.4-0.69", label: "0.4 – 0.69%", min: 0.4, max: 0.69 },
  { key: "0.7-0.99", label: "0.7 – 0.99%", min: 0.7, max: 0.99 },
  { key: "1.0-1.49", label: "1.0 – 1.49%", min: 1.0, max: 1.49 },
  { key: ">=1.5", label: "≥ 1.5%", min: 1.5, max: Infinity },
];

export interface GapDayData {
  date: string;
  dayOfWeek: number;
  direction: GapDirection;
  gapPercent: number;
  sizeBucket: GapSizeBucket;
  filled: boolean;
  todayOpen: number;
  prevClose: number;
  sessionHigh: number;
  sessionLow: number;
  bars: CandleBar[];
}

export interface GapBucketStats {
  total: number;
  filled: number;
  rate: number;
}

export interface GapFillStats {
  totalGapUp: number;
  filledGapUp: number;
  totalGapDown: number;
  filledGapDown: number;
  overallFillRate: number;
  gapUpFillRate: number;
  gapDownFillRate: number;
  byBucket: Record<GapSizeBucket, GapBucketStats>;
  byDayOfWeek: { day: string; total: number; filled: number; rate: number }[];
}

export interface GapFillResult {
  totalDays: number;
  stats: GapFillStats;
  allDays: GapDayData[];
  lastDay: GapDayData | null;
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

function classifyBucket(pct: number): GapSizeBucket {
  const abs = Math.abs(pct);
  for (const b of GAP_SIZE_BUCKETS) {
    if (abs >= b.min && abs <= b.max) return b.key;
  }
  return ">=1.5";
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function analyzeGapFill(bars: BarData[], maxDays: number = 0): GapFillResult {
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);

  const allSortedDates = Array.from(byDate.keys()).sort();
  const allDays: GapDayData[] = [];

  for (const date of dates) {
    const dateIdx = allSortedDates.indexOf(date);
    if (dateIdx <= 0) continue;

    const prevDate = allSortedDates[dateIdx - 1];
    const prevDayBars = byDate.get(prevDate)!;
    const todayBars = byDate.get(date)!;

    prevDayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());
    todayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const prevMarketBars = prevDayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (prevMarketBars.length === 0) continue;
    const prevClose = parseFloat(prevMarketBars[prevMarketBars.length - 1].close);

    const todayMarketBars = todayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (todayMarketBars.length === 0) continue;

    const todayOpen = parseFloat(todayMarketBars[0].open);
    const gapPercent = ((todayOpen - prevClose) / prevClose) * 100;

    if (Math.abs(gapPercent) < 0.01) continue;

    const direction: GapDirection = gapPercent > 0 ? "up" : "down";
    const sizeBucket = classifyBucket(gapPercent);

    let sessionHigh = -Infinity;
    let sessionLow = Infinity;
    for (const bar of todayMarketBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > sessionHigh) sessionHigh = h;
      if (l < sessionLow) sessionLow = l;
    }

    let filled = false;
    if (direction === "up") {
      filled = sessionLow <= prevClose;
    } else {
      filled = sessionHigh >= prevClose;
    }

    const dt = parseDateTime(todayMarketBars[0].datetime);

    allDays.push({
      date,
      dayOfWeek: dt.getDay(),
      direction,
      gapPercent,
      sizeBucket,
      filled,
      todayOpen,
      prevClose,
      sessionHigh,
      sessionLow,
      bars: todayMarketBars.map((b) => ({
        time: b.datetime.split(" ")[1].slice(0, 5),
        open: parseFloat(b.open),
        high: parseFloat(b.high),
        low: parseFloat(b.low),
        close: parseFloat(b.close),
      })),
    });
  }

  // Stats
  const gapUps = allDays.filter((d) => d.direction === "up");
  const gapDowns = allDays.filter((d) => d.direction === "down");
  const filledUp = gapUps.filter((d) => d.filled).length;
  const filledDown = gapDowns.filter((d) => d.filled).length;
  const totalFilled = filledUp + filledDown;
  const totalGaps = allDays.length;

  // By bucket
  const byBucket = {} as GapFillStats["byBucket"];
  for (const b of GAP_SIZE_BUCKETS) {
    const subset = allDays.filter((d) => d.sizeBucket === b.key);
    const filled = subset.filter((d) => d.filled).length;
    byBucket[b.key] = {
      total: subset.length,
      filled,
      rate: subset.length > 0 ? (filled / subset.length) * 100 : 0,
    };
  }

  // By day of week
  const byDayOfWeek = [1, 2, 3, 4, 5].map((dow) => {
    const subset = allDays.filter((d) => d.dayOfWeek === dow);
    const filled = subset.filter((d) => d.filled).length;
    return {
      day: DAY_NAMES[dow],
      total: subset.length,
      filled,
      rate: subset.length > 0 ? (filled / subset.length) * 100 : 0,
    };
  });

  return {
    totalDays: allDays.length,
    stats: {
      totalGapUp: gapUps.length,
      filledGapUp: filledUp,
      totalGapDown: gapDowns.length,
      filledGapDown: filledDown,
      overallFillRate: totalGaps > 0 ? (totalFilled / totalGaps) * 100 : 0,
      gapUpFillRate: gapUps.length > 0 ? (filledUp / gapUps.length) * 100 : 0,
      gapDownFillRate: gapDowns.length > 0 ? (filledDown / gapDowns.length) * 100 : 0,
      byBucket,
      byDayOfWeek,
    },
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
