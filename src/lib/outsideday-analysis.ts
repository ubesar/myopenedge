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
  isOutsideDay: boolean;
  sentiment: "bullish" | "bearish" | null;
  nextDayResult: "continuation" | "reversal" | "none" | null;
  /** Did next day hit 1:1 RR target (SL at opposite end of outside bar)? */
  rrHit: boolean | null;
}

export interface OutsideDayResult {
  totalDays: number;
  outsideDays: number;
  outsidePct: number;
  bullishOutside: number;
  bearishOutside: number;

  // Bullish outside → next day
  bullishContinuation: number;
  bullishReversal: number;
  bullishNone: number;
  bullishContinuationPct: number;
  bullishReversalPct: number;

  // Bearish outside → next day
  bearishContinuation: number;
  bearishReversal: number;
  bearishNone: number;
  bearishContinuationPct: number;
  bearishReversalPct: number;

  // 1:1 RR simulation
  bullishRRHits: number;
  bullishRRPct: number;
  bearishRRHits: number;
  bearishRRPct: number;

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
    dailyBars.push({ date, open, high, low, close });
  }

  const allDays: OutsideDayData[] = [];

  for (let i = 0; i < dailyBars.length; i++) {
    const today = dailyBars[i];
    const yesterday = i > 0 ? dailyBars[i - 1] : null;

    // Outside Day: High > yesterday High AND Low < yesterday Low
    const isOutsideDay = yesterday
      ? today.high > yesterday.high && today.low < yesterday.low
      : false;

    let sentiment: "bullish" | "bearish" | null = null;
    let nextDayResult: "continuation" | "reversal" | "none" | null = null;
    let rrHit: boolean | null = null;

    if (isOutsideDay) {
      sentiment = today.close > today.open ? "bullish" : "bearish";

      const nextDay = i + 1 < dailyBars.length ? dailyBars[i + 1] : null;

      if (nextDay) {
        // Use intraday bars of next day to determine which level was hit first
        const nextDayBars = byDate.get(nextDay.date);
        if (nextDayBars) {
          const sortedBars = nextDayBars
            .filter((b) => {
              const m = getTimeMinutes(parseDateTime(b.datetime));
              return m >= MARKET_OPEN && m < MARKET_CLOSE;
            })
            .sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

          let firstBreak: "high" | "low" | null = null;
          for (const bar of sortedBars) {
            const h = parseFloat(bar.high);
            const l = parseFloat(bar.low);
            if (h > today.high && firstBreak === null) { firstBreak = "high"; break; }
            if (l < today.low && firstBreak === null) { firstBreak = "low"; break; }
          }

          if (sentiment === "bullish") {
            // Continuation = breaks high first, Reversal = breaks low first
            if (firstBreak === "high") nextDayResult = "continuation";
            else if (firstBreak === "low") nextDayResult = "reversal";
            else nextDayResult = "none";
          } else {
            // Bearish: Continuation = breaks low first, Reversal = breaks high first
            if (firstBreak === "low") nextDayResult = "continuation";
            else if (firstBreak === "high") nextDayResult = "reversal";
            else nextDayResult = "none";
          }

          // 1:1 RR simulation
          // For bullish outside: entry at next day open, SL = outside bar low, TP = entry + (entry - SL)
          // For bearish outside: entry at next day open, SL = outside bar high, TP = entry - (SL - entry)
          const entryPrice = parseFloat(sortedBars[0]?.open || "0");
          if (entryPrice > 0) {
            if (sentiment === "bullish") {
              const sl = today.low;
              const risk = entryPrice - sl;
              if (risk > 0) {
                const tp = entryPrice + risk;
                let hit: "tp" | "sl" | null = null;
                for (const bar of sortedBars) {
                  const h = parseFloat(bar.high);
                  const l = parseFloat(bar.low);
                  if (l <= sl) { hit = "sl"; break; }
                  if (h >= tp) { hit = "tp"; break; }
                }
                rrHit = hit === "tp";
              }
            } else {
              const sl = today.high;
              const risk = sl - entryPrice;
              if (risk > 0) {
                const tp = entryPrice - risk;
                let hit: "tp" | "sl" | null = null;
                for (const bar of sortedBars) {
                  const h = parseFloat(bar.high);
                  const l = parseFloat(bar.low);
                  if (h >= sl) { hit = "sl"; break; }
                  if (l <= tp) { hit = "tp"; break; }
                }
                rrHit = hit === "tp";
              }
            }
          }
        }
      }
    }

    allDays.push({
      date: today.date,
      open: today.open,
      high: today.high,
      low: today.low,
      close: today.close,
      isOutsideDay,
      sentiment,
      nextDayResult,
      rrHit,
    });
  }

  const outsideDays = allDays.filter((d) => d.isOutsideDay);
  const bullish = outsideDays.filter((d) => d.sentiment === "bullish");
  const bearish = outsideDays.filter((d) => d.sentiment === "bearish");

  const bullishCont = bullish.filter((d) => d.nextDayResult === "continuation").length;
  const bullishRev = bullish.filter((d) => d.nextDayResult === "reversal").length;
  const bullishNone = bullish.filter((d) => d.nextDayResult === "none").length;

  const bearishCont = bearish.filter((d) => d.nextDayResult === "continuation").length;
  const bearishRev = bearish.filter((d) => d.nextDayResult === "reversal").length;
  const bearishNone = bearish.filter((d) => d.nextDayResult === "none").length;

  const bullishRRHits = bullish.filter((d) => d.rrHit === true).length;
  const bearishRRHits = bearish.filter((d) => d.rrHit === true).length;

  const totalDays = allDays.length > 0 ? allDays.length - 1 : 0;

  return {
    totalDays,
    outsideDays: outsideDays.length,
    outsidePct: totalDays > 0 ? (outsideDays.length / totalDays) * 100 : 0,
    bullishOutside: bullish.length,
    bearishOutside: bearish.length,

    bullishContinuation: bullishCont,
    bullishReversal: bullishRev,
    bullishNone,
    bullishContinuationPct: bullish.length > 0 ? (bullishCont / bullish.length) * 100 : 0,
    bullishReversalPct: bullish.length > 0 ? (bullishRev / bullish.length) * 100 : 0,

    bearishContinuation: bearishCont,
    bearishReversal: bearishRev,
    bearishNone,
    bearishContinuationPct: bearish.length > 0 ? (bearishCont / bearish.length) * 100 : 0,
    bearishReversalPct: bearish.length > 0 ? (bearishRev / bearish.length) * 100 : 0,

    bullishRRHits,
    bullishRRPct: bullish.length > 0 ? (bullishRRHits / bullish.length) * 100 : 0,
    bearishRRHits,
    bearishRRPct: bearish.length > 0 ? (bearishRRHits / bearish.length) * 100 : 0,

    allDays,
  };
}
