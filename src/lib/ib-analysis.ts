import { parse } from "date-fns";
import { aggregateToM15, type CandleBar } from "./m15-aggregation";

export type { CandleBar };

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface LastDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  breakout: "high" | "low" | "inside";
}

export type IBSubreport = "rejection" | "extension";

interface DirectionStats {
  total: number;
  breakHigh: number;
  breakLow: number;
  inside: number;
}

export interface AnalysisResult {
  totalDays: number;
  insideDays: number;
  ibWindowMinutes: number;
  subreport: IBSubreport;
  highFirst: DirectionStats;
  lowFirst: DirectionStats;
  lastDay: LastDayData | null;
  allDays: LastDayData[];
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30;
const NOON = 12 * 60;
const MARKET_CLOSE = 16 * 60;

export function analyzeIB(bars: BarData[], ibWindowMinutes: number = 60, maxDays: number = 0, subreport: IBSubreport = "rejection"): AnalysisResult {
  const ibEnd = IB_START + ibWindowMinutes;

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

  interface DayResult {
    date: string;
    ibHigh: number;
    ibLow: number;
    highFirstFormed: boolean;
    breakout: "high" | "low" | "inside";
  }

  const allDayResults: DayResult[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const ibBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < ibEnd;
    });

    if (ibBars.length < 2) continue;

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

    // Post-IB breakout: IB end to 12:00
    const postIBBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= ibEnd && m < NOON;
    });

    let breakout: "high" | "low" | "inside" = "inside";

    if (subreport === "rejection") {
      // By rejection: M15 candle CLOSE must break IB range
      const postIBCandles: CandleBar[] = postIBBars.map(b => ({
        time: b.datetime.split(" ")[1].slice(0, 5),
        open: parseFloat(b.open),
        high: parseFloat(b.high),
        low: parseFloat(b.low),
        close: parseFloat(b.close),
      }));
      const m15Candles = aggregateToM15(postIBCandles);
      for (const candle of m15Candles) {
        if (candle.close > ibHigh) { breakout = "high"; break; }
        if (candle.close < ibLow) { breakout = "low"; break; }
      }
    } else {
      // By extension: any bar's wick (high/low) penetrates IB range
      for (const bar of postIBBars) {
        const h = parseFloat(bar.high);
        const l = parseFloat(bar.low);
        if (h > ibHigh) { breakout = "high"; break; }
        if (l < ibLow) { breakout = "low"; break; }
      }
    }

    allDayResults.push({ date, ibHigh, ibLow, highFirstFormed, breakout });
  }

  const highFirstDays = allDayResults.filter((r) => r.highFirstFormed);
  const lowFirstDays = allDayResults.filter((r) => !r.highFirstFormed);
  const insideDays = allDayResults.filter((r) => r.breakout === "inside").length;
  const totalDays = allDayResults.filter((r) => r.breakout !== "inside").length;

  // Build all days' chart data
  const allDays: LastDayData[] = [];
  for (const dayResult of allDayResults) {
    const dayBars = byDate.get(dayResult.date);
    if (!dayBars) continue;
    const marketBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (marketBars.length === 0) continue;
    allDays.push({
      date: dayResult.date,
      bars: marketBars.map(b => ({
        time: b.datetime.split(" ")[1].slice(0, 5),
        open: parseFloat(b.open),
        high: parseFloat(b.high),
        low: parseFloat(b.low),
        close: parseFloat(b.close),
      })),
      ibHigh: dayResult.ibHigh,
      ibLow: dayResult.ibLow,
      highFirstFormed: dayResult.highFirstFormed,
      breakout: dayResult.breakout,
    });
  }

  const lastDay = allDays.length > 0 ? allDays[allDays.length - 1] : null;

  return {
    totalDays,
    insideDays,
    ibWindowMinutes,
    subreport,
    highFirst: {
      total: highFirstDays.length,
      breakHigh: highFirstDays.filter((r) => r.breakout === "high").length,
      breakLow: highFirstDays.filter((r) => r.breakout === "low").length,
      inside: highFirstDays.filter((r) => r.breakout === "inside").length,
    },
    lowFirst: {
      total: lowFirstDays.length,
      breakHigh: lowFirstDays.filter((r) => r.breakout === "high").length,
      breakLow: lowFirstDays.filter((r) => r.breakout === "low").length,
      inside: lowFirstDays.filter((r) => r.breakout === "inside").length,
    },
    lastDay,
    allDays,
  };
}
