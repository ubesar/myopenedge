import { parse } from "date-fns";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface NYGapM15Day {
  date: string;
  dayOfWeek: number;
  prevClose: number;
  nyOpen: number;
  m15Close: number;
  gapType: "Gap Up" | "Gap Down";
  gapSize: number;
  gapPercent: number;
  m15Direction: "Bullish" | "Bearish";
}

export interface NYGapM15Stats {
  totalDays: number;
  gapUpDays: number;
  gapDownDays: number;
  // When Gap Up: M15 probabilities
  gapUp: { bullish: number; bearish: number; bullishPct: number; bearishPct: number };
  // When Gap Down: M15 probabilities
  gapDown: { bullish: number; bearish: number; bullishPct: number; bearishPct: number };
  // By day of week
  byDayOfWeek: { day: string; gapUp: number; gapDown: number; bullish: number; bearish: number }[];
}

export interface NYGapM15Result {
  stats: NYGapM15Stats;
  allDays: NYGapM15Day[];
}

const IB_START = 9 * 60 + 30; // 09:30
const M15_END = 9 * 60 + 45;  // 09:45
const MARKET_CLOSE = 16 * 60;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

export function analyzeNYGapM15(
  bars: BarData[],
  maxDays: number = 0,
  minGapSize: number = 0
): NYGapM15Result {
  // Group bars by date
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);

  const allSortedDates = Array.from(byDate.keys()).sort();
  const allDays: NYGapM15Day[] = [];

  for (const date of dates) {
    const dateIdx = allSortedDates.indexOf(date);
    if (dateIdx <= 0) continue;

    const prevDate = allSortedDates[dateIdx - 1];
    const prevDayBars = byDate.get(prevDate)!;
    const todayBars = byDate.get(date)!;

    // Sort by time
    prevDayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());
    todayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Previous day close (last market hours bar)
    const prevMarketBars = prevDayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (prevMarketBars.length === 0) continue;
    const prevClose = parseFloat(prevMarketBars[prevMarketBars.length - 1].close);

    // Today's bars in market hours
    const todayMarketBars = todayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (todayMarketBars.length === 0) continue;

    // NY Open = first bar's open at 09:30
    const firstBar = todayMarketBars[0];
    const firstBarTime = getTimeMinutes(parseDateTime(firstBar.datetime));
    if (firstBarTime !== IB_START) continue; // Must start at 09:30
    const nyOpen = parseFloat(firstBar.open);

    // M15 Close = close of the bar(s) covering 09:30-09:45
    // With 5min data, we need the bar at 09:40 (which closes at 09:45)
    const m15Bars = todayMarketBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < M15_END;
    });
    if (m15Bars.length === 0) continue;
    const m15Close = parseFloat(m15Bars[m15Bars.length - 1].close);

    // Gap calculation
    const gapSize = Math.abs(nyOpen - prevClose);
    const gapPercent = ((nyOpen - prevClose) / prevClose) * 100;

    if (Math.abs(gapPercent) < 0.001) continue; // Skip no-gap days
    if (minGapSize > 0 && gapSize < minGapSize) continue;

    const gapType: "Gap Up" | "Gap Down" = nyOpen > prevClose ? "Gap Up" : "Gap Down";
    const m15Direction: "Bullish" | "Bearish" = m15Close > nyOpen ? "Bullish" : "Bearish";

    const dt = parseDateTime(firstBar.datetime);

    allDays.push({
      date,
      dayOfWeek: dt.getDay(),
      prevClose,
      nyOpen,
      m15Close,
      gapType,
      gapSize,
      gapPercent,
      m15Direction,
    });
  }

  // Compute stats
  const gapUps = allDays.filter((d) => d.gapType === "Gap Up");
  const gapDowns = allDays.filter((d) => d.gapType === "Gap Down");
  const guBullish = gapUps.filter((d) => d.m15Direction === "Bullish").length;
  const guBearish = gapUps.filter((d) => d.m15Direction === "Bearish").length;
  const gdBullish = gapDowns.filter((d) => d.m15Direction === "Bullish").length;
  const gdBearish = gapDowns.filter((d) => d.m15Direction === "Bearish").length;

  const byDayOfWeek = [1, 2, 3, 4, 5].map((dow) => {
    const subset = allDays.filter((d) => d.dayOfWeek === dow);
    return {
      day: DAY_NAMES[dow],
      gapUp: subset.filter((d) => d.gapType === "Gap Up").length,
      gapDown: subset.filter((d) => d.gapType === "Gap Down").length,
      bullish: subset.filter((d) => d.m15Direction === "Bullish").length,
      bearish: subset.filter((d) => d.m15Direction === "Bearish").length,
    };
  });

  return {
    stats: {
      totalDays: allDays.length,
      gapUpDays: gapUps.length,
      gapDownDays: gapDowns.length,
      gapUp: {
        bullish: guBullish,
        bearish: guBearish,
        bullishPct: gapUps.length > 0 ? (guBullish / gapUps.length) * 100 : 0,
        bearishPct: gapUps.length > 0 ? (guBearish / gapUps.length) * 100 : 0,
      },
      gapDown: {
        bullish: gdBullish,
        bearish: gdBearish,
        bullishPct: gapDowns.length > 0 ? (gdBullish / gapDowns.length) * 100 : 0,
        bearishPct: gapDowns.length > 0 ? (gdBearish / gapDowns.length) * 100 : 0,
      },
      byDayOfWeek,
    },
    allDays,
  };
}
