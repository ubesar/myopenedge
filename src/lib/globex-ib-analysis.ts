/**
 * Globex IB (Initial Balance) Analysis Engine
 *
 * Evaluates the relationship between the overnight Globex session
 * (6:00 PM – 9:30 AM ET) and the RTH session (9:30 AM – 4:00 PM ET).
 *
 * 1. Computes Globex IB range from Globex open for a configurable window (30 or 60 min).
 * 2. Tracks whether the overnight session breaks the Globex IB range.
 * 3. Monitors RTH (9:30 AM – 12:00 PM) for breakout vs the full Globex range.
 */

import { parse } from "date-fns";

export interface GlobexBar {
  datetime: string; // "YYYY-MM-DD HH:MM:SS" in ET
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface GlobexDayData {
  date: string; // RTH date (the "trading day")
  globexHigh: number;
  globexLow: number;
  globexIBHigh: number;
  globexIBLow: number;
  globexBrokeIBHigh: boolean; // did overnight break Globex IB high?
  globexBrokeIBLow: boolean;
  rthBreakout: "high" | "low" | "inside"; // RTH breakout vs full Globex range
  highFirstFormed: boolean; // was Globex IB high formed before low?
}

export interface GlobexIBResult {
  totalDays: number;
  ibWindowMinutes: number;
  highFirst: {
    total: number;
    breakHigh: number;
    breakLow: number;
    inside: number;
  };
  lowFirst: {
    total: number;
    breakHigh: number;
    breakLow: number;
    inside: number;
  };
  globexIBBreakStats: {
    brokeHigh: number;
    brokeLow: number;
    brokeBoth: number;
    stayedInside: number;
  };
  allDays: GlobexDayData[];
  lastDay: GlobexDayData | null;
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

// Globex session: 6:00 PM previous day to 9:30 AM current day
const GLOBEX_START = 18 * 60; // 18:00 (6 PM)
const GLOBEX_END = 9 * 60 + 30; // 09:30
const RTH_START = 9 * 60 + 30; // 09:30
const RTH_BREAKOUT_END = 12 * 60; // 12:00

/**
 * Groups bars into trading days (Globex overnight + RTH).
 * A "trading day" starts at 6:00 PM the previous calendar day and ends at 4:00 PM.
 */
function groupByTradingDay(bars: GlobexBar[]): Map<string, { globexBars: GlobexBar[]; rthBars: GlobexBar[] }> {
  const tradingDays = new Map<string, { globexBars: GlobexBar[]; rthBars: GlobexBar[] }>();

  for (const bar of bars) {
    const dt = parseDateTime(bar.datetime);
    const minutes = getTimeMinutes(dt);
    const calendarDate = bar.datetime.split(" ")[0];

    let tradingDate: string;
    let isGlobex: boolean;

    if (minutes >= GLOBEX_START) {
      // After 6 PM = belongs to NEXT trading day's Globex session
      const nextDay = new Date(dt);
      nextDay.setDate(nextDay.getDate() + 1);
      tradingDate = nextDay.toISOString().split("T")[0];
      isGlobex = true;
    } else if (minutes < GLOBEX_END) {
      // Before 9:30 AM = Globex session of current trading day
      tradingDate = calendarDate;
      isGlobex = true;
    } else {
      // 9:30 AM onwards = RTH
      tradingDate = calendarDate;
      isGlobex = false;
    }

    if (!tradingDays.has(tradingDate)) {
      tradingDays.set(tradingDate, { globexBars: [], rthBars: [] });
    }

    const day = tradingDays.get(tradingDate)!;
    if (isGlobex) {
      day.globexBars.push(bar);
    } else {
      day.rthBars.push(bar);
    }
  }

  return tradingDays;
}

export function analyzeGlobexIB(
  bars: GlobexBar[],
  ibWindowMinutes: number = 60,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5]
): GlobexIBResult {
  const tradingDays = groupByTradingDay(bars);

  let dates = Array.from(tradingDays.keys()).sort();

  // Filter by weekdays
  dates = dates.filter((d) => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  if (maxDays > 0) {
    dates = dates.slice(-maxDays);
  }

  const allDays: GlobexDayData[] = [];

  for (const date of dates) {
    const { globexBars, rthBars } = tradingDays.get(date)!;

    if (globexBars.length < 2 || rthBars.length < 2) continue;

    // Sort bars chronologically
    globexBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());
    rthBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Find Globex open time (first bar)
    const globexOpenTime = parseDateTime(globexBars[0].datetime).getTime();

    // Compute Globex IB (first N minutes from Globex open)
    const ibEndTime = globexOpenTime + ibWindowMinutes * 60 * 1000;
    const ibBars = globexBars.filter((b) => parseDateTime(b.datetime).getTime() < ibEndTime);

    if (ibBars.length < 1) continue;

    let ibHigh = -Infinity;
    let ibLow = Infinity;
    let firstHighTouch = 0;
    let firstLowTouch = 0;

    for (const bar of ibBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > ibHigh) {
        ibHigh = h;
        firstHighTouch = parseDateTime(bar.datetime).getTime();
      }
      if (l < ibLow) {
        ibLow = l;
        firstLowTouch = parseDateTime(bar.datetime).getTime();
      }
    }

    const highFirstFormed = firstHighTouch < firstLowTouch;

    // Full Globex range
    let globexHigh = -Infinity;
    let globexLow = Infinity;
    for (const bar of globexBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > globexHigh) globexHigh = h;
      if (l < globexLow) globexLow = l;
    }

    // Did overnight break Globex IB?
    const postIBGlobexBars = globexBars.filter((b) => parseDateTime(b.datetime).getTime() >= ibEndTime);
    let globexBrokeIBHigh = false;
    let globexBrokeIBLow = false;
    for (const bar of postIBGlobexBars) {
      const c = parseFloat(bar.close);
      if (c > ibHigh) globexBrokeIBHigh = true;
      if (c < ibLow) globexBrokeIBLow = true;
    }

    // RTH breakout vs full Globex range (9:30 AM – 12:00 PM)
    const rthBreakoutBars = rthBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= RTH_START && m < RTH_BREAKOUT_END;
    });

    let rthBreakout: "high" | "low" | "inside" = "inside";
    for (const bar of rthBreakoutBars) {
      const c = parseFloat(bar.close);
      if (c > globexHigh) {
        rthBreakout = "high";
        break;
      }
      if (c < globexLow) {
        rthBreakout = "low";
        break;
      }
    }

    allDays.push({
      date,
      globexHigh,
      globexLow,
      globexIBHigh: ibHigh,
      globexIBLow: ibLow,
      globexBrokeIBHigh,
      globexBrokeIBLow,
      rthBreakout,
      highFirstFormed,
    });
  }

  const highFirstDays = allDays.filter((d) => d.highFirstFormed);
  const lowFirstDays = allDays.filter((d) => !d.highFirstFormed);

  const globexIBBreakStats = {
    brokeHigh: allDays.filter((d) => d.globexBrokeIBHigh && !d.globexBrokeIBLow).length,
    brokeLow: allDays.filter((d) => d.globexBrokeIBLow && !d.globexBrokeIBHigh).length,
    brokeBoth: allDays.filter((d) => d.globexBrokeIBHigh && d.globexBrokeIBLow).length,
    stayedInside: allDays.filter((d) => !d.globexBrokeIBHigh && !d.globexBrokeIBLow).length,
  };

  return {
    totalDays: allDays.length,
    ibWindowMinutes,
    highFirst: {
      total: highFirstDays.length,
      breakHigh: highFirstDays.filter((d) => d.rthBreakout === "high").length,
      breakLow: highFirstDays.filter((d) => d.rthBreakout === "low").length,
      inside: highFirstDays.filter((d) => d.rthBreakout === "inside").length,
    },
    lowFirst: {
      total: lowFirstDays.length,
      breakHigh: lowFirstDays.filter((d) => d.rthBreakout === "high").length,
      breakLow: lowFirstDays.filter((d) => d.rthBreakout === "low").length,
      inside: lowFirstDays.filter((d) => d.rthBreakout === "inside").length,
    },
    globexIBBreakStats,
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
