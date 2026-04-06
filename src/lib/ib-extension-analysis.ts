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

export interface ExtensionDayDetail {
  date: string;
  ibHigh: number;
  ibLow: number;
  ibRange: number;
  ib50: number;
  breakDirection: "bullish" | "bearish" | "none";
  reached25: boolean;
  reached50: boolean;
  reached100: boolean;
  pulledBackToIB50: boolean;
  continuedAfterPullback: boolean;
  dayClose: number;
}

export interface ExtensionLevelStats {
  reached: number;
  reachedPct: number;
  withPullback: number;
  withPullbackPct: number;
  continuedAfterPullback: number;
  continuationPct: number;
}

export interface ExtensionResult {
  totalDays: number;
  ibWindow: 30 | 60;
  pullbackWindow: 30 | 60;
  bullishBreaks: number;
  bearishBreaks: number;
  noBreaks: number;
  ext25: ExtensionLevelStats;
  ext50: ExtensionLevelStats;
  ext100: ExtensionLevelStats;
  details: ExtensionDayDetail[];
}

/* ─── Helpers ─── */

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
function getTimeMin(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30; // 09:30
const MARKET_CLOSE = 16 * 60; // 16:00

/* ─── Main Analysis ─── */

export function analyzeIBExtension(
  rawBars: BarData[],
  ibWindow: 30 | 60 = 60,
  pullbackWindow: 30 | 60 = 30,
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

    const ib50 = (ibHigh + ibLow) / 2;

    // Post-IB bars
    const postIBBars = dayBars.filter((b) => {
      const [h, m] = b.time.split(":").map(Number);
      return h * 60 + m >= ibEnd && h * 60 + m < MARKET_CLOSE;
    });

    // Determine initial breakout direction
    let breakDirection: "bullish" | "bearish" | "none" = "none";
    let firstBreakIdx = -1;

    for (let i = 0; i < postIBBars.length; i++) {
      const bar = postIBBars[i];
      if (bar.close > ibHigh) {
        breakDirection = "bullish";
        firstBreakIdx = i;
        break;
      }
      if (bar.close < ibLow) {
        breakDirection = "bearish";
        firstBreakIdx = i;
        break;
      }
    }

    // Extension levels
    const ext25Level = breakDirection === "bullish" ? ibHigh + ibRange * 0.25 : ibLow - ibRange * 0.25;
    const ext50Level = breakDirection === "bullish" ? ibHigh + ibRange * 0.5 : ibLow - ibRange * 0.5;
    const ext100Level = breakDirection === "bullish" ? ibHigh + ibRange : ibLow - ibRange;

    let reached25 = false;
    let reached50 = false;
    let reached100 = false;

    if (breakDirection !== "none") {
      for (const bar of postIBBars) {
        if (breakDirection === "bullish") {
          if (bar.high >= ext25Level) reached25 = true;
          if (bar.high >= ext50Level) reached50 = true;
          if (bar.high >= ext100Level) reached100 = true;
        } else {
          if (bar.low <= ext25Level) reached25 = true;
          if (bar.low <= ext50Level) reached50 = true;
          if (bar.low <= ext100Level) reached100 = true;
        }
      }
    }

    // Pullback to IB 50% detection: after breakout, check if price returns to IB midpoint
    // within the pullbackWindow minutes after breakout
    let pulledBackToIB50 = false;
    let continuedAfterPullback = false;

    if (breakDirection !== "none" && firstBreakIdx >= 0) {
      const breakBar = postIBBars[firstBreakIdx];
      const [bh, bm] = breakBar.time.split(":").map(Number);
      const breakTime = bh * 60 + bm;
      const pullbackDeadline = breakTime + pullbackWindow;

      // Check bars after breakout within pullback window
      const pullbackBars = postIBBars.filter((b, idx) => {
        if (idx <= firstBreakIdx) return false;
        const [h, m] = b.time.split(":").map(Number);
        const t = h * 60 + m;
        return t <= pullbackDeadline;
      });

      for (const bar of pullbackBars) {
        if (breakDirection === "bullish" && bar.low <= ib50) {
          pulledBackToIB50 = true;
          break;
        }
        if (breakDirection === "bearish" && bar.high >= ib50) {
          pulledBackToIB50 = true;
          break;
        }
      }

      // After pullback, check if price continued in original direction
      if (pulledBackToIB50) {
        const afterPullbackBars = postIBBars.filter((b) => {
          const [h, m] = b.time.split(":").map(Number);
          const t = h * 60 + m;
          return t > pullbackDeadline;
        });

        const dayClose = dayBars[dayBars.length - 1].close;
        if (breakDirection === "bullish") {
          continuedAfterPullback = dayClose > ibHigh;
        } else {
          continuedAfterPullback = dayClose < ibLow;
        }
      }
    }

    const dayClose = dayBars[dayBars.length - 1].close;

    details.push({
      date,
      ibHigh,
      ibLow,
      ibRange,
      ib50,
      breakDirection,
      reached25,
      reached50,
      reached100,
      pulledBackToIB50,
      continuedAfterPullback,
      dayClose,
    });
  }

  const breakDays = details.filter((d) => d.breakDirection !== "none");
  const bullish = details.filter((d) => d.breakDirection === "bullish");
  const bearish = details.filter((d) => d.breakDirection === "bearish");

  function calcLevel(field: "reached25" | "reached50" | "reached100"): ExtensionLevelStats {
    const reached = breakDays.filter((d) => d[field]);
    const withPullback = reached.filter((d) => d.pulledBackToIB50);
    const continued = withPullback.filter((d) => d.continuedAfterPullback);
    return {
      reached: reached.length,
      reachedPct: breakDays.length > 0 ? (reached.length / breakDays.length) * 100 : 0,
      withPullback: withPullback.length,
      withPullbackPct: reached.length > 0 ? (withPullback.length / reached.length) * 100 : 0,
      continuedAfterPullback: continued.length,
      continuationPct: withPullback.length > 0 ? (continued.length / withPullback.length) * 100 : 0,
    };
  }

  return {
    totalDays: details.length,
    ibWindow,
    pullbackWindow,
    bullishBreaks: bullish.length,
    bearishBreaks: bearish.length,
    noBreaks: details.filter((d) => d.breakDirection === "none").length,
    ext25: calcLevel("reached25"),
    ext50: calcLevel("reached50"),
    ext100: calcLevel("reached100"),
    details,
  };
}
