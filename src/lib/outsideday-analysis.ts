import { parse } from "date-fns";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface OutsideDayData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Edgeful model: open > prev high = bullish, open < prev low = bearish */
  type: "bullish" | "bearish" | null;
  /** Did price retrace to touch the prior day's key level? */
  filledGap: boolean | null;
  /** Session close direction */
  closedGreen: boolean | null;
  /** Gap size as % of prior day close */
  gapPct: number | null;
}

export interface OutsideDayDirectionStats {
  total: number;
  filledGap: number;
  filledGapPct: number;
  didNotFill: number;
  didNotFillPct: number;
  closedGreen: number;
  closedRed: number;
  closedGreenPct: number;
  closedRedPct: number;
}

export interface OutsideDayResult {
  totalDays: number;
  outsideDays: number;
  outsidePct: number;
  bullish: OutsideDayDirectionStats;
  bearish: OutsideDayDirectionStats;
  allDays: OutsideDayData[];
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const MARKET_OPEN = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;

export function analyzeOutsideDay(bars: BarData[], maxDays: number = 0, weekdays: number[] = [1,2,3,4,5]): OutsideDayResult {
  // Group 5-min bars by date → build daily OHLC
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter(d => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  interface DailyOHLC {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    marketBars: { high: number; low: number; open: number; close: number; time: number }[];
  }

  const dailyBars: DailyOHLC[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    const marketBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= MARKET_OPEN && m < MARKET_CLOSE;
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

    const parsedBars = marketBars.map(b => ({
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      open: parseFloat(b.open),
      close: parseFloat(b.close),
      time: getTimeMinutes(parseDateTime(b.datetime)),
    }));

    dailyBars.push({ date, open, high, low, close, marketBars: parsedBars });
  }

  const allDays: OutsideDayData[] = [];

  for (let i = 0; i < dailyBars.length; i++) {
    const today = dailyBars[i];
    const yesterday = i > 0 ? dailyBars[i - 1] : null;

    let type: "bullish" | "bearish" | null = null;
    let filledGap: boolean | null = null;
    let closedGreen: boolean | null = null;
    let gapPct: number | null = null;

    if (yesterday) {
      // Edgeful definition:
      // Bullish outside day: today's open > yesterday's high
      // Bearish outside day: today's open < yesterday's low
      if (today.open > yesterday.high) {
        type = "bullish";
        gapPct = yesterday.close > 0 ? ((today.open - yesterday.high) / yesterday.close) * 100 : 0;
        // Did price retrace to touch yesterday's high?
        filledGap = today.marketBars.some(b => b.low <= yesterday.high);
        closedGreen = today.close > today.open;
      } else if (today.open < yesterday.low) {
        type = "bearish";
        gapPct = yesterday.close > 0 ? ((yesterday.low - today.open) / yesterday.close) * 100 : 0;
        // Did price retrace to touch yesterday's low?
        filledGap = today.marketBars.some(b => b.high >= yesterday.low);
        closedGreen = today.close > today.open;
      }
    }

    allDays.push({
      date: today.date,
      open: today.open,
      high: today.high,
      low: today.low,
      close: today.close,
      type,
      filledGap,
      closedGreen,
      gapPct,
    });
  }

  const outsideDays = allDays.filter(d => d.type !== null);
  const bullishDays = outsideDays.filter(d => d.type === "bullish");
  const bearishDays = outsideDays.filter(d => d.type === "bearish");

  function calcStats(days: OutsideDayData[]): OutsideDayDirectionStats {
    const total = days.length;
    const filled = days.filter(d => d.filledGap === true).length;
    const notFilled = days.filter(d => d.filledGap === false).length;
    const green = days.filter(d => d.closedGreen === true).length;
    const red = days.filter(d => d.closedGreen === false).length;
    return {
      total,
      filledGap: filled,
      filledGapPct: total > 0 ? (filled / total) * 100 : 0,
      didNotFill: notFilled,
      didNotFillPct: total > 0 ? (notFilled / total) * 100 : 0,
      closedGreen: green,
      closedRed: red,
      closedGreenPct: total > 0 ? (green / total) * 100 : 0,
      closedRedPct: total > 0 ? (red / total) * 100 : 0,
    };
  }

  const totalDays = allDays.length > 0 ? allDays.length - 1 : 0;

  return {
    totalDays,
    outsideDays: outsideDays.length,
    outsidePct: totalDays > 0 ? (outsideDays.length / totalDays) * 100 : 0,
    bullish: calcStats(bullishDays),
    bearish: calcStats(bearishDays),
    allDays,
  };
}
