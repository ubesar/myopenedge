import { parse, isAfter, isBefore, isEqual, format } from "date-fns";

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
const IB_END = 10 * 60 + 30;  // 10:30
const MARKET_CLOSE = 16 * 60;  // 16:00

export function analyzeIB(bars: BarData[]): AnalysisResult {
  // Group by date
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  const results: DayResult[] = [];

  for (const [date, dayBars] of byDate) {
    // Sort chronologically
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // IB window bars
    const ibBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < IB_END;
    });

    if (ibBars.length < 2) continue;

    // Find IB High and Low
    let ibHigh = -Infinity;
    let ibLow = Infinity;
    let ibHighTime = "";
    let ibLowTime = "";

    for (const bar of ibBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > ibHigh) {
        ibHigh = h;
        ibHighTime = bar.datetime;
      }
      if (l < ibLow) {
        ibLow = l;
        ibLowTime = bar.datetime;
      }
    }

    // First touch times
    let firstHighTouch = "";
    let firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }

    const highFirstFormed = parseDateTime(firstHighTouch).getTime() < parseDateTime(firstLowTouch).getTime();

    // Post-IB bars
    const postIBBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_END && m < MARKET_CLOSE;
    });

    let breakout: "high" | "low" | "inside" = "inside";
    for (const bar of postIBBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > ibHigh) {
        breakout = "high";
        break;
      }
      if (l < ibLow) {
        breakout = "low";
        break;
      }
    }

    if (breakout === "inside") continue;

    results.push({ date, ibHigh, ibLow, highFirstFormed, breakout });
  }

  const highFirst = results.filter((r) => r.highFirstFormed);
  const lowFirst = results.filter((r) => !r.highFirstFormed);

  return {
    totalDays: results.length,
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
