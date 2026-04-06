import { parse } from "date-fns";
import type { CandleBar } from "./m15-aggregation";

/* ─── Types ─── */

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type BreakType = "single_high" | "single_low" | "double" | "no_break";

export interface ExtensionDayDetail {
  date: string;
  ibHigh: number;
  ibLow: number;
  ibRange: number;
  breakType: BreakType;
  /** highest extension multiple reached (e.g. 0.3 means 0.3x IB range) */
  maxExtMultiple: number;
}

export interface ExtensionLevelStat {
  level: number; // e.g. 0.1, 0.2, …
  label: string; // "-0.8" … "0.8"
  reachedCount: number;
  reachedPct: number;
}

export interface ExtensionResult {
  totalDays: number;
  ibWindow: 30 | 60;
  levels: ExtensionLevelStat[];
  details: ExtensionDayDetail[];
  breakCounts: { all: number; breakout: number; breakdown: number; double: number; noBreak: number };
}

/* ─── Helpers ─── */

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
function getTimeMin(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;

const EXTENSION_LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

/* ─── Main Analysis ─── */

export function analyzeIBExtension(
  rawBars: BarData[],
  ibWindow: 30 | 60 = 60,
  _pullbackWindow: 30 | 60 = 30,
  maxDays: number = 240,
  weekdays: number[] = [1, 2, 3, 4, 5]
): ExtensionResult {
  const ibEnd = IB_START + ibWindow;

  // Parse and filter RTH bars
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

  const details: ExtensionDayDetail[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    if (dayBars.length < 6) continue;

    // Calculate IB range
    const ibBars = dayBars.filter((b) => {
      const [h, m] = b.time.split(":").map(Number);
      const t = h * 60 + m;
      return t >= IB_START && t < ibEnd;
    });
    if (ibBars.length < 2) continue;

    const ibHigh = Math.max(...ibBars.map((b) => b.high));
    const ibLow = Math.min(...ibBars.map((b) => b.low));
    const ibRange = ibHigh - ibLow;
    if (ibRange <= 0) continue;

    // Post-IB bars
    const postIBBars = dayBars.filter((b) => {
      const [h, m] = b.time.split(":").map(Number);
      return h * 60 + m >= ibEnd && h * 60 + m < MARKET_CLOSE;
    });

    // Determine break type
    let brokeHigh = false;
    let brokeLow = false;
    for (const bar of postIBBars) {
      if (bar.high > ibHigh) brokeHigh = true;
      if (bar.low < ibLow) brokeLow = true;
    }

    let breakType: BreakType = "no_break";
    if (brokeHigh && brokeLow) breakType = "double";
    else if (brokeHigh) breakType = "single_high";
    else if (brokeLow) breakType = "single_low";

    // Calculate max extension multiple in either direction
    let maxExt = 0;
    for (const bar of postIBBars) {
      const extUp = (bar.high - ibHigh) / ibRange;
      const extDown = (ibLow - bar.low) / ibRange;
      maxExt = Math.max(maxExt, extUp, extDown);
    }

    details.push({
      date,
      ibHigh,
      ibLow,
      ibRange,
      breakType,
      maxExtMultiple: maxExt,
    });
  }

  const breakCounts = {
    all: details.length,
    breakout: details.filter((d) => d.breakType === "single_high").length,
    breakdown: details.filter((d) => d.breakType === "single_low").length,
    double: details.filter((d) => d.breakType === "double").length,
    noBreak: details.filter((d) => d.breakType === "no_break").length,
  };

  // Calculate levels stats (based on ALL days by default; filtering happens in UI)
  const levels: ExtensionLevelStat[] = EXTENSION_LEVELS.map((lvl) => {
    const reached = details.filter((d) => d.maxExtMultiple >= lvl).length;
    return {
      level: lvl,
      label: lvl.toFixed(1),
      reachedCount: reached,
      reachedPct: details.length > 0 ? (reached / details.length) * 100 : 0,
    };
  });

  return {
    totalDays: details.length,
    ibWindow,
    levels,
    details,
    breakCounts,
  };
}

/** Recalculate level stats for a filtered subset of details */
export function calcLevelsForFilter(details: ExtensionDayDetail[]): ExtensionLevelStat[] {
  return EXTENSION_LEVELS.map((lvl) => {
    const reached = details.filter((d) => d.maxExtMultiple >= lvl).length;
    return {
      level: lvl,
      label: lvl.toFixed(1),
      reachedCount: reached,
      reachedPct: details.length > 0 ? (reached / details.length) * 100 : 0,
    };
  });
}
