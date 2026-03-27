/**
 * London IB (Initial Balance) Analysis Engine
 *
 * Evaluates breakout behavior during the London session (03:00 AM – 11:30 AM ET).
 * Data sourced from Massive API (Polygon) since London session is outside RTH.
 *
 * 1. Computes London IB range from London open (03:00 AM ET) for a configurable window.
 * 2. Tracks whether price breaks the London IB range during the rest of the session.
 * 3. Classifies break types: single, double, or no break.
 */

import { parse } from "date-fns";

export interface LondonBar {
  datetime: string; // "YYYY-MM-DD HH:MM:SS" in ET
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface LondonDayData {
  date: string;
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  breakout: "high" | "low" | "inside";
  breakType: "single" | "double" | "none";
}

export interface LondonIBResult {
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
  breakTypeStats: {
    singleBreak: number;
    doubleBreak: number;
    noBreak: number;
    singleBreakPct: number;
    doubleBreakPct: number;
    noBreakPct: number;
  };
  allDays: LondonDayData[];
  lastDay: LondonDayData | null;
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

// London session times in ET
const LONDON_OPEN = 3 * 60;        // 03:00 AM ET (earliest; actual bars may start at 04:00)
const LONDON_CLOSE = 11 * 60 + 30; // 11:30 AM ET

// Minimum time to consider as London session start (pre-market usually starts 04:00 AM ET)
const LONDON_PREMARKET_START = 4 * 60; // 04:00 AM ET fallback

export function analyzeLondonIB(
  bars: LondonBar[],
  ibWindowMinutes: number = 60,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5]
): LondonIBResult {
  

  // Group bars by calendar date
  const byDate = new Map<string, LondonBar[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();

  // Filter by weekdays
  dates = dates.filter((d) => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  if (maxDays > 0) {
    dates = dates.slice(-maxDays);
  }

  const allDays: LondonDayData[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Filter London session bars (03:00/04:00 – 11:30 ET)
    // Use LONDON_OPEN (03:00) as the earliest, but data may only start at 04:00
    const londonBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= LONDON_OPEN && m < LONDON_CLOSE;
    });

    if (londonBars.length < 4) continue;

    // Detect actual session start from first available bar
    const firstBarMinutes = getTimeMinutes(parseDateTime(londonBars[0].datetime));
    const actualIBStart = firstBarMinutes;
    const ibEndMinutes = actualIBStart + ibWindowMinutes;

    // IB bars: first N minutes from actual session start
    const ibBars = londonBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= actualIBStart && m < ibEndMinutes;
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

    // Detect which extreme formed first (the tell)
    let firstHighTouch = "";
    let firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }

    const highFirstFormed = parseDateTime(firstHighTouch).getTime() < parseDateTime(firstLowTouch).getTime();

    // Post-IB bars: after IB window until London close
    const postIBBars = londonBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= ibEndMinutes && m < LONDON_CLOSE;
    });

    // Track breaks (by rejection / candle close)
    let brokeHigh = false;
    let brokeLow = false;
    let firstBreakout: "high" | "low" | "inside" = "inside";

    for (const bar of postIBBars) {
      const c = parseFloat(bar.close);
      if (c > ibHigh && !brokeHigh) {
        brokeHigh = true;
        if (firstBreakout === "inside") firstBreakout = "high";
      }
      if (c < ibLow && !brokeLow) {
        brokeLow = true;
        if (firstBreakout === "inside") firstBreakout = "low";
      }
    }

    // Classify break type
    let breakType: "single" | "double" | "none";
    if (brokeHigh && brokeLow) {
      breakType = "double";
    } else if (brokeHigh || brokeLow) {
      breakType = "single";
    } else {
      breakType = "none";
    }

    allDays.push({ date, ibHigh, ibLow, highFirstFormed, breakout: firstBreakout, breakType });
  }

  const totalDays = allDays.length;
  const highFirstDays = allDays.filter((d) => d.highFirstFormed);
  const lowFirstDays = allDays.filter((d) => !d.highFirstFormed);

  const singleBreak = allDays.filter((d) => d.breakType === "single").length;
  const doubleBreak = allDays.filter((d) => d.breakType === "double").length;
  const noBreak = allDays.filter((d) => d.breakType === "none").length;

  return {
    totalDays,
    ibWindowMinutes,
    highFirst: {
      total: highFirstDays.length,
      breakHigh: highFirstDays.filter((d) => d.breakout === "high").length,
      breakLow: highFirstDays.filter((d) => d.breakout === "low").length,
      inside: highFirstDays.filter((d) => d.breakout === "inside").length,
    },
    lowFirst: {
      total: lowFirstDays.length,
      breakHigh: lowFirstDays.filter((d) => d.breakout === "high").length,
      breakLow: lowFirstDays.filter((d) => d.breakout === "low").length,
      inside: lowFirstDays.filter((d) => d.breakout === "inside").length,
    },
    breakTypeStats: {
      singleBreak,
      doubleBreak,
      noBreak,
      singleBreakPct: totalDays > 0 ? (singleBreak / totalDays) * 100 : 0,
      doubleBreakPct: totalDays > 0 ? (doubleBreak / totalDays) * 100 : 0,
      noBreakPct: totalDays > 0 ? (noBreak / totalDays) * 100 : 0,
    },
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
