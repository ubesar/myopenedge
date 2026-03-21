import { parse } from "date-fns";
import { aggregateBars, type CandleBar } from "./m15-aggregation";

export type { CandleBar };

interface BarData {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export type OCCCandleSize = "5m" | "15m" | "30m" | "1h";

export interface OCCDayResult {
  date: string;
  openingCandleGreen: boolean; // true = green/bullish, false = red/bearish
  dayEndGreen: boolean; // true = daily close > daily open (green day)
  openingCandle: CandleBar;
  dailyOpen: number;
  dailyClose: number;
}

export interface OCCDirectionResult {
  total: number;
  greenDayCount: number;
  redDayCount: number;
  greenDayPct: number;
  redDayPct: number;
}

export interface OCCResult {
  totalDays: number;
  candleSize: OCCCandleSize;
  candleSizeMinutes: number;
  greenCandle: OCCDirectionResult; // when opening candle was green
  redCandle: OCCDirectionResult;   // when opening candle was red
  allDays: OCCDayResult[];
}

const CANDLE_SIZE_MAP: Record<OCCCandleSize, number> = {
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
};

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30; // 09:30
const MARKET_CLOSE = 16 * 60; // 16:00

export function analyzeOCC(
  bars: BarData[],
  maxDays: number = 0,
  candleSize: OCCCandleSize = "30m",
  weekdays: number[] = [1, 2, 3, 4, 5]
): OCCResult {
  const candleSizeMinutes = CANDLE_SIZE_MAP[candleSize];

  // Group bars by date
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

  const allDays: OCCDayResult[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Filter RTH bars (09:30 - 16:00)
    const rthBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });

    if (rthBars.length < 6) continue; // need minimum data

    const bars5min: CandleBar[] = rthBars.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    // Get opening candle: aggregate first N minutes from 09:30
    const endMinute = IB_START + candleSizeMinutes;
    const openingBars = bars5min.filter((b) => {
      const [h, m] = b.time.split(":").map(Number);
      const totalMin = h * 60 + m;
      return totalMin >= IB_START && totalMin < endMinute;
    });

    const aggregated = aggregateBars(openingBars, candleSizeMinutes);
    if (aggregated.length === 0) continue;

    const openingCandle = aggregated[0];
    const openingCandleGreen = openingCandle.close > openingCandle.open;

    // Daily open = first bar open, daily close = last bar close
    const dailyOpen = bars5min[0].open;
    const dailyClose = bars5min[bars5min.length - 1].close;
    const dayEndGreen = dailyClose > dailyOpen;

    allDays.push({
      date,
      openingCandleGreen,
      dayEndGreen,
      openingCandle,
      dailyOpen,
      dailyClose,
    });
  }

  // Calculate stats for green candle days vs red candle days
  const greenCandleDays = allDays.filter((d) => d.openingCandleGreen);
  const redCandleDays = allDays.filter((d) => !d.openingCandleGreen);

  const greenCandle: OCCDirectionResult = {
    total: greenCandleDays.length,
    greenDayCount: greenCandleDays.filter((d) => d.dayEndGreen).length,
    redDayCount: greenCandleDays.filter((d) => !d.dayEndGreen).length,
    greenDayPct: greenCandleDays.length > 0
      ? (greenCandleDays.filter((d) => d.dayEndGreen).length / greenCandleDays.length) * 100
      : 0,
    redDayPct: greenCandleDays.length > 0
      ? (greenCandleDays.filter((d) => !d.dayEndGreen).length / greenCandleDays.length) * 100
      : 0,
  };

  const redCandle: OCCDirectionResult = {
    total: redCandleDays.length,
    greenDayCount: redCandleDays.filter((d) => d.dayEndGreen).length,
    redDayCount: redCandleDays.filter((d) => !d.dayEndGreen).length,
    greenDayPct: redCandleDays.length > 0
      ? (redCandleDays.filter((d) => d.dayEndGreen).length / redCandleDays.length) * 100
      : 0,
    redDayPct: redCandleDays.length > 0
      ? (redCandleDays.filter((d) => !d.dayEndGreen).length / redCandleDays.length) * 100
      : 0,
  };

  return {
    totalDays: allDays.length,
    candleSize,
    candleSizeMinutes,
    greenCandle,
    redCandle,
    allDays,
  };
}
