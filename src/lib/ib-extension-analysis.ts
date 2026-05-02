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
  /** highest upward extension multiple (breakout above IB high) */
  maxExtUp: number;
  /** highest downward extension multiple (breakdown below IB low) */
  maxExtDown: number;
}

export interface ExtensionLevelStat {
  level: number;
  label: string;
  reachedCount: number;
  reachedPct: number;
}

export interface ExtensionResult {
  totalDays: number;
  ibWindow: 30 | 60;
  /** Upward extension stats (positive levels: 0.3 to 1.0) */
  levelsUp: ExtensionLevelStat[];
  /** Downward extension stats (negative levels: -0.3 to -1.0) */
  levelsDown: ExtensionLevelStat[];
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

const EXTENSION_LEVELS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

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

    // Determine break type & directional extensions
    let brokeHigh = false;
    let brokeLow = false;
    let maxExtUp = 0;
    let maxExtDown = 0;

    for (const bar of postIBBars) {
      if (bar.high > ibHigh) {
        brokeHigh = true;
        const extUp = (bar.high - ibHigh) / ibRange;
        maxExtUp = Math.max(maxExtUp, extUp);
      }
      if (bar.low < ibLow) {
        brokeLow = true;
        const extDown = (ibLow - bar.low) / ibRange;
        maxExtDown = Math.max(maxExtDown, extDown);
      }
    }

    let breakType: BreakType = "no_break";
    if (brokeHigh && brokeLow) breakType = "double";
    else if (brokeHigh) breakType = "single_high";
    else if (brokeLow) breakType = "single_low";

    details.push({
      date,
      ibHigh,
      ibLow,
      ibRange,
      breakType,
      maxExtUp,
      maxExtDown,
    });
  }

  const breakCounts = {
    all: details.length,
    breakout: details.filter((d) => d.breakType === "single_high").length,
    breakdown: details.filter((d) => d.breakType === "single_low").length,
    double: details.filter((d) => d.breakType === "double").length,
    noBreak: details.filter((d) => d.breakType === "no_break").length,
  };

  const levelsUp = calcDirectionalLevels(details, "up");
  const levelsDown = calcDirectionalLevels(details, "down");

  return {
    totalDays: details.length,
    ibWindow,
    levelsUp,
    levelsDown,
    details,
    breakCounts,
  };
}

/** Calculate level stats for a specific direction */
function calcDirectionalLevels(
  details: ExtensionDayDetail[],
  direction: "up" | "down"
): ExtensionLevelStat[] {
  return EXTENSION_LEVELS.map((lvl) => {
    const reached = details.filter((d) =>
      direction === "up" ? d.maxExtUp >= lvl : d.maxExtDown >= lvl
    ).length;
    return {
      level: lvl,
      label: direction === "down" ? `-${lvl.toFixed(1)}` : lvl.toFixed(1),
      reachedCount: reached,
      reachedPct: details.length > 0 ? (reached / details.length) * 100 : 0,
    };
  });
}

/** Recalculate level stats for a filtered subset of details */
export function calcLevelsForFilter(
  details: ExtensionDayDetail[],
  direction: "up" | "down"
): ExtensionLevelStat[] {
  return calcDirectionalLevels(details, direction);
}
