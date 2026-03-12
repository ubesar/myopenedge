import { parse } from "date-fns";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface InsideBarDayData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  isInsideBar: boolean;
  breakout: "high" | "low" | "stayed" | null; // null if not inside bar
}

export interface InsideBarResult {
  totalDays: number;
  insideBarDays: number;
  outsideDays: number;
  stayedInsideDays: number;
  brokeOutDays: number;
  brokeHighDays: number;
  brokeLowDays: number;
  insideBarPct: number;
  outsidePct: number;
  breakoutPct: number;
  stayedPct: number;
  brokeHighPct: number;
  brokeLowPct: number;
  allDays: InsideBarDayData[];
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;

export function analyzeInsideBar(bars: BarData[], maxDays: number = 0): InsideBarResult {
  // Group 5-min bars by date and build daily OHLC
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

  // Build daily OHLC from intraday bars (09:30-16:00)
  interface DailyOHLC {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }

  const dailyBars: DailyOHLC[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    const marketBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });

    if (marketBars.length < 2) continue;

    marketBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const open = parseFloat(marketBars[0].open);
    const close = parseFloat(marketBars[marketBars.length - 1].close);
    let high = -Infinity;
    let low = Infinity;

    for (const bar of marketBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > high) high = h;
      if (l < low) low = l;
    }

    dailyBars.push({ date, open, high, low, close });
  }

  // Detect inside bars and track breakouts
  const allDays: InsideBarDayData[] = [];

  for (let i = 0; i < dailyBars.length; i++) {
    const today = dailyBars[i];
    const yesterday = i > 0 ? dailyBars[i - 1] : null;

    const isInsideBar = yesterday
      ? today.high < yesterday.high && today.low > yesterday.low
      : false;

    let breakout: "high" | "low" | "stayed" | null = null;

    if (isInsideBar && yesterday) {
      // Check if next day breaks out of yesterday's range
      // Actually, check if TODAY's price action broke yesterday's range
      // Since today IS the inside bar, we track the NEXT day's breakout
      // But per the PRD: track the current day's breakout relative to previous day's range
      // The inside bar itself stays within range. We check the DAY AFTER the inside bar.
      
      // Look at next day to see breakout
      const nextDay = i + 1 < dailyBars.length ? dailyBars[i + 1] : null;
      if (nextDay) {
        if (nextDay.high > yesterday.high) {
          breakout = "high";
        } else if (nextDay.low < yesterday.low) {
          breakout = "low";
        } else {
          breakout = "stayed";
        }
      } else {
        breakout = "stayed"; // No next day data
      }
    }

    allDays.push({
      date: today.date,
      open: today.open,
      high: today.high,
      low: today.low,
      close: today.close,
      isInsideBar,
      breakout,
    });
  }

  const insideBarDays = allDays.filter((d) => d.isInsideBar);
  const totalInsideBars = insideBarDays.length;
  const stayedInsideDays = insideBarDays.filter((d) => d.breakout === "stayed").length;
  const brokeOutDays = insideBarDays.filter((d) => d.breakout === "high" || d.breakout === "low").length;
  const brokeHighDays = insideBarDays.filter((d) => d.breakout === "high").length;
  const brokeLowDays = insideBarDays.filter((d) => d.breakout === "low").length;

  // Total analyzable days (days that have a previous day to compare)
  const totalDays = allDays.length > 0 ? allDays.length - 1 : 0; // exclude first day (no comparison)

  return {
    totalDays,
    insideBarDays: totalInsideBars,
    outsideDays: totalDays - totalInsideBars,
    stayedInsideDays,
    brokeOutDays,
    brokeHighDays,
    brokeLowDays,
    insideBarPct: totalDays > 0 ? (totalInsideBars / totalDays) * 100 : 0,
    outsidePct: totalDays > 0 ? ((totalDays - totalInsideBars) / totalDays) * 100 : 0,
    breakoutPct: totalInsideBars > 0 ? (brokeOutDays / totalInsideBars) * 100 : 0,
    stayedPct: totalInsideBars > 0 ? (stayedInsideDays / totalInsideBars) * 100 : 0,
    brokeHighPct: totalInsideBars > 0 ? (brokeHighDays / totalInsideBars) * 100 : 0,
    brokeLowPct: totalInsideBars > 0 ? (brokeLowDays / totalInsideBars) * 100 : 0,
    allDays,
  };
}
