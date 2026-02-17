import { parse } from "date-fns";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

interface DayResult {
  date: string;
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  breakout: "high" | "low" | "inside";
}

export interface CandleBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LastDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  breakout: "high" | "low" | "inside";
}

export interface AnalysisResult {
  totalDays: number;
  insideDays: number;
  ibWindowMinutes: number;
  highFirst: { total: number; breakHigh: number; breakLow: number };
  lowFirst: { total: number; breakHigh: number; breakLow: number };
  lastDay: LastDayData | null;
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30; // 09:30
const MARKET_CLOSE = 16 * 60; // 16:00

export function analyzeIB(bars: BarData[], ibWindowMinutes: number = 60, maxDays: number = 0): AnalysisResult {
  const ibEnd = IB_START + ibWindowMinutes;

  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  // Sort dates and limit if maxDays > 0
  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) {
    dates = dates.slice(-maxDays);
  }

  const allDayResults: DayResult[] = [];
  let totalTradingDays = 0;

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const ibBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < ibEnd;
    });

    if (ibBars.length < 2) continue;
    totalTradingDays++;

    let ibHigh = -Infinity;
    let ibLow = Infinity;

    for (const bar of ibBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > ibHigh) ibHigh = h;
      if (l < ibLow) ibLow = l;
    }

    let firstHighTouch = "";
    let firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }

    const highFirstFormed = parseDateTime(firstHighTouch).getTime() < parseDateTime(firstLowTouch).getTime();

    const postIBBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= ibEnd && m < MARKET_CLOSE;
    });

    let breakout: "high" | "low" | "inside" = "inside";
    for (const bar of postIBBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > ibHigh) { breakout = "high"; break; }
      if (l < ibLow) { breakout = "low"; break; }
    }

    allDayResults.push({ date, ibHigh, ibLow, highFirstFormed, breakout });
  }

  const breakoutDays = allDayResults.filter((r) => r.breakout !== "inside");
  const insideDays = allDayResults.filter((r) => r.breakout === "inside").length;
  const highFirst = breakoutDays.filter((r) => r.highFirstFormed);
  const lowFirst = breakoutDays.filter((r) => !r.highFirstFormed);

  // Get the most recent day's data for candlestick chart
  let lastDay: LastDayData | null = null;
  if (allDayResults.length > 0) {
    const sortedDates = allDayResults.map(r => r.date).sort();
    const lastDate = sortedDates[sortedDates.length - 1];
    const lastDayBars = byDate.get(lastDate);
    const lastDayResult = allDayResults.find(r => r.date === lastDate);
    if (lastDayBars && lastDayResult) {
      const marketBars = lastDayBars.filter((b) => {
        const m = getTimeMinutes(parseDateTime(b.datetime));
        return m >= IB_START && m < MARKET_CLOSE;
      });
      lastDay = {
        date: lastDate,
        bars: marketBars.map(b => ({
          time: b.datetime.split(" ")[1].slice(0, 5),
          open: parseFloat(b.open),
          high: parseFloat(b.high),
          low: parseFloat(b.low),
          close: parseFloat(b.close),
        })),
        ibHigh: lastDayResult.ibHigh,
        ibLow: lastDayResult.ibLow,
        highFirstFormed: lastDayResult.highFirstFormed,
        breakout: lastDayResult.breakout,
      };
    }
  }

  return {
    totalDays: breakoutDays.length,
    insideDays,
    ibWindowMinutes,
    highFirst: {
      total: highFirst.length,
      breakHigh: highFirst.filter((r) => r.breakout === "high").length,
      breakLow: highFirst.filter((r) => r.breakout === "low").length,
    },
    lowFirst: {
      total: lowFirst.length,
      breakHigh: lowFirst.filter((r) => r.breakout === "high").length,
      breakLow: lowFirst.filter((r) => r.breakout === "low").length,
    },
    lastDay,
  };
}
