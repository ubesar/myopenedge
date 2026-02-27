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
export type GapSize = "small" | "medium" | "large";

export interface GapDayData {
  date: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  direction: GapDirection;
  gapPercent: number;
  gapSize: GapSize;
  filled: boolean;
  todayOpen: number;
  prevClose: number;
  sessionHigh: number;
  sessionLow: number;
  bars: CandleBar[];
}

export interface GapFillStats {
  totalGapUp: number;
  filledGapUp: number;
  totalGapDown: number;
  filledGapDown: number;
  overallFillRate: number;
  gapUpFillRate: number;
  gapDownFillRate: number;
  bySize: Record<GapSize, { total: number; filled: number; rate: number }>;
  byDayOfWeek: { day: string; total: number; filled: number; rate: number }[];
  currentSession: {
    hasGap: boolean;
    direction: GapDirection | null;
    gapPercent: number;
    gapSize: GapSize | null;
    historicalFillRate: number;
    filled: boolean;
  } | null;
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

function classifyGapSize(pct: number): GapSize {
  const abs = Math.abs(pct);
  if (abs <= 0.5) return "small";
  if (abs <= 1.0) return "medium";
  return "large";
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function analyzeGapFill(bars: BarData[], maxDays: number = 0): GapFillResult {
  // Group bars by date
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) {
    dates = dates.slice(-maxDays);
  }

  // We need previous day's close, so start from index 1
  const allSortedDates = Array.from(byDate.keys()).sort();
  const allDays: GapDayData[] = [];

  for (const date of dates) {
    const dateIdx = allSortedDates.indexOf(date);
    if (dateIdx <= 0) continue;

    const prevDate = allSortedDates[dateIdx - 1];
    const prevDayBars = byDate.get(prevDate)!;
    const todayBars = byDate.get(date)!;

    // Sort bars by time
    prevDayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());
    todayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Get previous day's last bar close (market hours)
    const prevMarketBars = prevDayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (prevMarketBars.length === 0) continue;
    const prevClose = parseFloat(prevMarketBars[prevMarketBars.length - 1].close);

    // Get today's market bars
    const todayMarketBars = todayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (todayMarketBars.length === 0) continue;

    const todayOpen = parseFloat(todayMarketBars[0].open);
    const gapPercent = ((todayOpen - prevClose) / prevClose) * 100;

    // Skip tiny gaps (< 0.01%)
    if (Math.abs(gapPercent) < 0.01) continue;

    const direction: GapDirection = gapPercent > 0 ? "up" : "down";
    const gapSize = classifyGapSize(gapPercent);

    // Check if gap filled during the session
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
      // Gap Up fills if Low <= PrevClose
      filled = sessionLow <= prevClose;
    } else {
      // Gap Down fills if High >= PrevClose
      filled = sessionHigh >= prevClose;
    }

    const dt = parseDateTime(todayMarketBars[0].datetime);

    allDays.push({
      date,
      dayOfWeek: dt.getDay(),
      direction,
      gapPercent,
      gapSize,
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

  // Calculate stats
  const gapUps = allDays.filter((d) => d.direction === "up");
  const gapDowns = allDays.filter((d) => d.direction === "down");
  const filledUp = gapUps.filter((d) => d.filled).length;
  const filledDown = gapDowns.filter((d) => d.filled).length;
  const totalFilled = filledUp + filledDown;
  const totalGaps = allDays.length;

  // By size
  const sizes: GapSize[] = ["small", "medium", "large"];
  const bySize = {} as GapFillStats["bySize"];
  for (const s of sizes) {
    const subset = allDays.filter((d) => d.gapSize === s);
    const filled = subset.filter((d) => d.filled).length;
    bySize[s] = {
      total: subset.length,
      filled,
      rate: subset.length > 0 ? (filled / subset.length) * 100 : 0,
    };
  }

  // By day of week (Mon-Fri only)
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

  // Current session (last day)
  const lastDay = allDays.length > 0 ? allDays[allDays.length - 1] : null;
  let currentSession: GapFillStats["currentSession"] = null;
  if (lastDay) {
    // Historical fill rate for similar gaps
    const similar = allDays.filter(
      (d) => d.direction === lastDay.direction && d.gapSize === lastDay.gapSize && d !== lastDay
    );
    const similarFilled = similar.filter((d) => d.filled).length;
    currentSession = {
      hasGap: true,
      direction: lastDay.direction,
      gapPercent: lastDay.gapPercent,
      gapSize: lastDay.gapSize,
      historicalFillRate: similar.length > 0 ? (similarFilled / similar.length) * 100 : 0,
      filled: lastDay.filled,
    };
  }

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
      bySize,
      byDayOfWeek,
      currentSession,
    },
    allDays,
    lastDay,
  };
}
