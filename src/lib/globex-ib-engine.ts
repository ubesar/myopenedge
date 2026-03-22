import type {
  GlobexIBWindow,
  GlobexBreakDirection,
  RTHOpenPosition,
  RTHOutcome,
  RTHFirstTest,
  GlobexIBResult,
  GlobexIBStats,
  ConditionalBreakdown,
  NormalizedBar,
} from "@/types/globex-ib";

// Convert a Date to NY timezone components
function toNY(date: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const str = date.toLocaleString("en-US", { timeZone: "America/New_York" });
  const parts = new Date(str);
  return {
    year: parts.getFullYear(),
    month: parts.getMonth(),
    day: parts.getDate(),
    hour: parts.getHours(),
    minute: parts.getMinutes(),
    weekday: parts.getDay(),
  };
}

function nyMinutes(date: Date): number {
  const ny = toNY(date);
  return ny.hour * 60 + ny.minute;
}

function nyDateStr(date: Date): string {
  const ny = toNY(date);
  return `${ny.year}-${String(ny.month + 1).padStart(2, "0")}-${String(ny.day).padStart(2, "0")}`;
}

// Get the RTH date for a bar (evening bars map to next business day)
function getRTHDate(barDate: Date): string {
  const ny = toNY(barDate);
  const mins = ny.hour * 60 + ny.minute;

  // If bar is 6PM-11:59PM → next business day
  if (mins >= 18 * 60) {
    const next = new Date(barDate.getTime() + 24 * 60 * 60 * 1000);
    const nextNY = toNY(next);
    // Skip weekends
    if (nextNY.weekday === 0) {
      // Sunday → Monday
      const mon = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      return nyDateStr(mon);
    }
    if (nextNY.weekday === 6) {
      // Saturday → Monday
      const mon = new Date(next.getTime() + 2 * 24 * 60 * 60 * 1000);
      return nyDateStr(mon);
    }
    return nyDateStr(next);
  }

  // 12AM-9:30AM same calendar day → that day's RTH
  // 9:30AM-4PM → that day's RTH
  return nyDateStr(barDate);
}

// Is bar in Globex session? (6PM-9:30AM ET)
function isGlobexBar(barDate: Date): boolean {
  const mins = nyMinutes(barDate);
  return mins >= 18 * 60 || mins < 9 * 60 + 30;
}

// Is bar in RTH session? (9:30AM-4PM ET)
function isRTHBar(barDate: Date): boolean {
  const mins = nyMinutes(barDate);
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

// Is bar in Globex IB window? (6PM to 6PM + ibWindow minutes)
function isGlobexIBBar(barDate: Date, ibWindowMinutes: GlobexIBWindow): boolean {
  const mins = nyMinutes(barDate);
  const ibEnd = 18 * 60 + ibWindowMinutes;
  // IB window starts at 6PM (1080 mins)
  if (ibEnd <= 24 * 60) {
    return mins >= 18 * 60 && mins < ibEnd;
  }
  // Wraps past midnight
  const wrappedEnd = ibEnd - 24 * 60;
  return mins >= 18 * 60 || mins < wrappedEnd;
}

// Post-IB Globex: after IB ends, before 9:30AM
function isPostIBGlobexBar(barDate: Date, ibWindowMinutes: GlobexIBWindow): boolean {
  const mins = nyMinutes(barDate);
  const ibEnd = 18 * 60 + ibWindowMinutes;

  if (ibEnd <= 24 * 60) {
    // IB ends before midnight
    return (mins >= ibEnd && mins < 24 * 60) || (mins >= 0 && mins < 9 * 60 + 30);
  }
  // IB ends after midnight
  const wrappedEnd = ibEnd - 24 * 60;
  return mins >= wrappedEnd && mins < 9 * 60 + 30;
}

// RTH monitoring window: 9:30AM - 12:00PM
function isRTHMonitorBar(barDate: Date): boolean {
  const mins = nyMinutes(barDate);
  return mins >= 9 * 60 + 30 && mins < 12 * 60;
}

export function analyzeGlobexIB(
  bars: NormalizedBar[],
  ibWindow: GlobexIBWindow = 60,
  maxDays: number = 0,
  weekdays: number[] = [1, 2, 3, 4, 5]
): { results: GlobexIBResult[]; stats: GlobexIBStats } {
  // Sort bars chronologically
  const sorted = [...bars].sort((a, b) => a.timestamp - b.timestamp);

  // Group bars by RTH date
  const byRTHDate = new Map<string, NormalizedBar[]>();
  for (const bar of sorted) {
    const barDate = new Date(bar.timestamp);
    const rthDate = getRTHDate(barDate);
    if (!byRTHDate.has(rthDate)) byRTHDate.set(rthDate, []);
    byRTHDate.get(rthDate)!.push(bar);
  }

  let dates = Array.from(byRTHDate.keys()).sort();

  // Filter by weekdays
  dates = dates.filter((d) => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  if (maxDays > 0) {
    dates = dates.slice(-maxDays);
  }

  const results: GlobexIBResult[] = [];

  for (const rthDate of dates) {
    const dayBars = byRTHDate.get(rthDate)!;

    // Separate globex and RTH bars
    const globexBars: NormalizedBar[] = [];
    const globexIBBars: NormalizedBar[] = [];
    const postIBGlobexBars: NormalizedBar[] = [];
    const rthBars: NormalizedBar[] = [];
    const rthMonitorBars: NormalizedBar[] = [];

    for (const bar of dayBars) {
      const bd = new Date(bar.timestamp);
      if (isGlobexBar(bd)) {
        globexBars.push(bar);
        if (isGlobexIBBar(bd, ibWindow)) globexIBBars.push(bar);
        if (isPostIBGlobexBar(bd, ibWindow)) postIBGlobexBars.push(bar);
      }
      if (isRTHBar(bd)) {
        rthBars.push(bar);
        if (isRTHMonitorBar(bd)) rthMonitorBars.push(bar);
      }
    }

    if (globexIBBars.length < 2 || rthBars.length === 0) continue;

    // Globex IB range
    let globexIBHigh = -Infinity;
    let globexIBLow = Infinity;
    for (const bar of globexIBBars) {
      if (bar.high > globexIBHigh) globexIBHigh = bar.high;
      if (bar.low < globexIBLow) globexIBLow = bar.low;
    }

    // Full Globex range
    let globexHigh = -Infinity;
    let globexLow = Infinity;
    for (const bar of globexBars) {
      if (bar.high > globexHigh) globexHigh = bar.high;
      if (bar.low < globexLow) globexLow = bar.low;
    }

    // Globex IB break direction (post-IB overnight, by candle CLOSE)
    let brokeHigh = false;
    let brokeLow = false;
    for (const bar of postIBGlobexBars) {
      if (bar.close > globexIBHigh) brokeHigh = true;
      if (bar.close < globexIBLow) brokeLow = true;
    }

    let globexBreakDirection: GlobexBreakDirection = "INSIDE";
    if (brokeHigh && brokeLow) globexBreakDirection = "BOTH";
    else if (brokeHigh) globexBreakDirection = "BREAK_HIGH";
    else if (brokeLow) globexBreakDirection = "BREAK_LOW";

    // RTH open position vs Globex range
    const rthOpen = rthBars[0].open;
    const globexMid = (globexHigh + globexLow) / 2;
    const globexRange = globexHigh - globexLow;
    const threshold = globexRange * 0.25;

    let rthOpenPosition: RTHOpenPosition;
    if (rthOpen > globexHigh) rthOpenPosition = "ABOVE";
    else if (rthOpen < globexLow) rthOpenPosition = "BELOW";
    else if (rthOpen > globexMid + threshold) rthOpenPosition = "INSIDE_UPPER";
    else if (rthOpen < globexMid - threshold) rthOpenPosition = "INSIDE_LOWER";
    else rthOpenPosition = "MID";

    // RTH breakout (9:30AM - 12:00PM, candle CLOSE outside Globex range)
    let rthOutcome: RTHOutcome = "INSIDE";
    let rthBreakoutBar: string | null = null;
    for (const bar of rthMonitorBars) {
      if (bar.close > globexHigh) {
        rthOutcome = "BREAK_HIGH";
        rthBreakoutBar = bar.datetime;
        break;
      }
      if (bar.close < globexLow) {
        rthOutcome = "BREAK_LOW";
        rthBreakoutBar = bar.datetime;
        break;
      }
    }

    // First test: which Globex extreme does RTH approach first (0.1% threshold)
    let rthFirstTest: RTHFirstTest = "NONE";
    const testThreshold = 0.001;
    for (const bar of rthMonitorBars) {
      const highDist = Math.abs(bar.high - globexHigh) / globexHigh;
      const lowDist = Math.abs(bar.low - globexLow) / globexLow;
      if (highDist <= testThreshold) { rthFirstTest = "HIGH"; break; }
      if (lowDist <= testThreshold) { rthFirstTest = "LOW"; break; }
    }

    results.push({
      rthDate,
      globexHigh,
      globexLow,
      globexRange,
      globexIBHigh,
      globexIBLow,
      globexIBRange: globexIBHigh - globexIBLow,
      globexBreakDirection,
      rthOpen,
      rthOpenPosition,
      rthOutcome,
      rthFirstTest,
      rthBreakoutBar,
    });
  }

  return { results, stats: calculateGlobexStats(results) };
}

function makeBreakdown(label: string, items: GlobexIBResult[]): ConditionalBreakdown {
  const total = items.length;
  const breakHigh = items.filter((r) => r.rthOutcome === "BREAK_HIGH").length;
  const breakLow = items.filter((r) => r.rthOutcome === "BREAK_LOW").length;
  const inside = items.filter((r) => r.rthOutcome === "INSIDE").length;
  return {
    label,
    total,
    breakHigh,
    breakLow,
    inside,
    breakHighPct: total > 0 ? (breakHigh / total) * 100 : 0,
    breakLowPct: total > 0 ? (breakLow / total) * 100 : 0,
    insidePct: total > 0 ? (inside / total) * 100 : 0,
  };
}

function calculateGlobexStats(results: GlobexIBResult[]): GlobexIBStats {
  const total = results.length;
  const breakHigh = results.filter((r) => r.rthOutcome === "BREAK_HIGH").length;
  const breakLow = results.filter((r) => r.rthOutcome === "BREAK_LOW").length;
  const inside = results.filter((r) => r.rthOutcome === "INSIDE").length;

  // By RTH open position
  const positions: RTHOpenPosition[] = ["ABOVE", "BELOW", "INSIDE_UPPER", "INSIDE_LOWER", "MID"];
  const byRTHOpenPosition = positions
    .map((pos) => makeBreakdown(pos, results.filter((r) => r.rthOpenPosition === pos)))
    .filter((b) => b.total > 0);

  // By Globex IB break direction
  const directions: GlobexBreakDirection[] = ["BREAK_HIGH", "BREAK_LOW", "BOTH", "INSIDE"];
  const byGlobexBreakDirection = directions
    .map((dir) => makeBreakdown(dir, results.filter((r) => r.globexBreakDirection === dir)))
    .filter((b) => b.total > 0);

  // By first test
  const tests: RTHFirstTest[] = ["HIGH", "LOW", "NONE"];
  const byFirstTest = tests
    .map((t) => makeBreakdown(t, results.filter((r) => r.rthFirstTest === t)))
    .filter((b) => b.total > 0);

  return {
    totalDays: total,
    breakHigh,
    breakLow,
    inside,
    breakHighPct: total > 0 ? (breakHigh / total) * 100 : 0,
    breakLowPct: total > 0 ? (breakLow / total) * 100 : 0,
    insidePct: total > 0 ? (inside / total) * 100 : 0,
    byRTHOpenPosition,
    byGlobexBreakDirection,
    byFirstTest,
  };
}
