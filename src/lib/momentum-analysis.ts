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

export interface MomentumSignal {
  type: "bullish" | "bearish";
  times: [string, string];
}

export interface MomentumDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  momentum: "bullish" | "bearish" | "choppy";
  signals: MomentumSignal[];
}

export interface MomentumResult {
  totalDays: number;
  bullishDays: number;
  bearishDays: number;
  choppyDays: number;
  ibWindowMinutes: number;
  highFirst: { total: number; bullish: number; bearish: number; choppy: number };
  lowFirst: { total: number; bullish: number; bearish: number; choppy: number };
  allDays: MomentumDayData[];
  lastDay: MomentumDayData | null;
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

export function analyzeMomentum(bars: BarData[], ibWindowMinutes: number = 60, maxDays: number = 0): MomentumResult {
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

  const allDays: MomentumDayData[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // IB calculation
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

    // Momentum detection: only within IB window, M15 candles
    const momentumBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < ibEnd;
    });

    const momentumCandles: CandleBar[] = momentumBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const m15 = aggregateToM15(momentumCandles);

    // Scan ALL consecutive M15 pairs — all must be valid & same direction
    const signals: MomentumSignal[] = [];
    let allValid = m15.length >= 2;
    let direction: "bullish" | "bearish" | null = null;

    for (let j = 0; j < m15.length - 1 && allValid; j++) {
      const prev = m15[j];
      const curr = m15[j + 1];

      const prevBody = Math.abs(prev.close - prev.open);
      const prevRange = prev.high - prev.low;
      const currBody = Math.abs(curr.close - curr.open);
      const currRange = curr.high - curr.low;

      const prevBullish = prev.close >= prev.open;
      const currBullish = curr.close >= curr.open;
      const sameColor = prevBullish === currBullish;

      if (
        prevRange > 0 && currRange > 0 &&
        prevBody / prevRange >= 0.50 &&
        currBody / currRange >= 0.30 &&
        sameColor
      ) {
        const pairDirection = prevBullish ? "bullish" : "bearish";
        if (direction === null) {
          direction = pairDirection;
        } else if (direction !== pairDirection) {
          allValid = false;
        }
        signals.push({
          type: pairDirection,
          times: [prev.time, curr.time],
        });
      } else {
        allValid = false;
      }
    }

    const momentum = allValid && direction ? direction : "choppy";

    // Full day bars for chart
    const fullDayBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });

    if (fullDayBars.length === 0) continue;

    allDays.push({
      date,
      bars: fullDayBars.map(b => ({
        time: b.datetime.split(" ")[1].slice(0, 5),
        open: parseFloat(b.open),
        high: parseFloat(b.high),
        low: parseFloat(b.low),
        close: parseFloat(b.close),
      })),
      ibHigh,
      ibLow,
      highFirstFormed,
      momentum,
      signals,
    });
  }

  const highFirstDays = allDays.filter((d) => d.highFirstFormed);
  const lowFirstDays = allDays.filter((d) => !d.highFirstFormed);

  return {
    totalDays: allDays.length,
    bullishDays: allDays.filter((d) => d.momentum === "bullish").length,
    bearishDays: allDays.filter((d) => d.momentum === "bearish").length,
    choppyDays: allDays.filter((d) => d.momentum === "choppy").length,
    ibWindowMinutes,
    highFirst: {
      total: highFirstDays.length,
      bullish: highFirstDays.filter((d) => d.momentum === "bullish").length,
      bearish: highFirstDays.filter((d) => d.momentum === "bearish").length,
      choppy: highFirstDays.filter((d) => d.momentum === "choppy").length,
    },
    lowFirst: {
      total: lowFirstDays.length,
      bullish: lowFirstDays.filter((d) => d.momentum === "bullish").length,
      bearish: lowFirstDays.filter((d) => d.momentum === "bearish").length,
      choppy: lowFirstDays.filter((d) => d.momentum === "choppy").length,
    },
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
