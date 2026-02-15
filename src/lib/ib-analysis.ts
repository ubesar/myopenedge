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

export interface AnalysisResult {
  totalDays: number;
  insideDays: number;
  ibWindowMinutes: number;
  highFirst: { total: number; breakHigh: number; breakLow: number };
  lowFirst: { total: number; breakHigh: number; breakLow: number };
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30; // 09:30
const MARKET_CLOSE = 16 * 60; // 16:00

export function analyzeIB(bars: BarData[], ibWindowMinutes: number = 60): AnalysisResult {
  const ibEnd = IB_START + ibWindowMinutes;

  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  const allDayResults: DayResult[] = [];
  let totalTradingDays = 0;

  for (const [date, dayBars] of byDate) {
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
  };
}
