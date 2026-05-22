import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface MCCWindowResult {
  totalDays: number;
  bodyRatioThreshold: number;
  windowMinutes: number; // 60 (9:30 - 10:30)
  bullishSignals: number;
  bullishContinued: number;
  bullishReversed: number;
  bearishSignals: number;
  bearishContinued: number;
  bearishReversed: number;
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const SESSION_START = 9 * 60 + 30; // 9:30
const SESSION_END = 16 * 60; // 16:00

/**
 * Scan M15 candles within the NY open window (default 9:30 - 10:30).
 * For each M15 candle in that window, if it qualifies as a momentum candle
 * (|body|/range >= bodyRatio), record a signal and check whether the full
 * session (16:00 close vs 9:30 open) closed in the same direction.
 */
export function analyzeMCCWindow(
  bars: BarData[],
  windowMinutes: number = 60,
  maxDays: number = 0,
  bodyRatio: number = 0.7,
  weekdays: number[] = [1, 2, 3, 4, 5]
): MCCWindowResult {
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);
  dates = dates.filter((d) => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  const windowEnd = SESSION_START + windowMinutes;

  let totalDays = 0;
  let bullishSignals = 0;
  let bullishContinued = 0;
  let bearishSignals = 0;
  let bearishContinued = 0;

  for (const date of dates) {
    const dayBars = byDate
      .get(date)!
      .slice()
      .sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    const sessionRaw = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= SESSION_START && m < SESSION_END;
    });
    if (sessionRaw.length === 0) continue;

    const session5m: CandleBar[] = sessionRaw.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const sessionOpen = session5m[0].open;
    const sessionClose = session5m[session5m.length - 1].close;
    const sessionBullish = sessionClose > sessionOpen;

    const m15 = aggregateBars(session5m, 15);
    const windowCandles = m15.filter((c) => {
      const [h, mm] = c.time.split(":").map(Number);
      const min = h * 60 + mm;
      return min >= SESSION_START && min < windowEnd;
    });
    if (windowCandles.length === 0) continue;

    totalDays++;

    for (const c of windowCandles) {
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      const ratio = range > 0 ? body / range : 0;
      if (ratio < bodyRatio) continue;
      const dir = c.close > c.open ? "bullish" : c.close < c.open ? "bearish" : "none";
      if (dir === "bullish") {
        bullishSignals++;
        if (sessionBullish) bullishContinued++;
      } else if (dir === "bearish") {
        bearishSignals++;
        if (!sessionBullish) bearishContinued++;
      }
    }
  }

  return {
    totalDays,
    bodyRatioThreshold: bodyRatio,
    windowMinutes,
    bullishSignals,
    bullishContinued,
    bullishReversed: bullishSignals - bullishContinued,
    bearishSignals,
    bearishContinued,
    bearishReversed: bearishSignals - bearishContinued,
  };
}
