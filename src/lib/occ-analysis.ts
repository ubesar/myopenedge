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

export type OCCStatus = "bullish" | "bearish" | "failed";

export interface OCCTimeframeResult {
  tf: string;
  tfMinutes: number;
  candle1: CandleBar | null;
  candle2: CandleBar | null;
  status: OCCStatus;
}

export interface OCCDayData {
  date: string;
  bars: CandleBar[];
  timeframes: OCCTimeframeResult[];
  overallBias: OCCStatus; // majority across 4 TFs
}

export interface OCCDirectionStats {
  total: number;
  valid: number;
  invalid: number;
}

export interface OCCTFDirectionStats {
  bullishFirst: OCCDirectionStats;
  bearishFirst: OCCDirectionStats;
}

export interface OCCResult {
  totalDays: number;
  bullishDays: number;
  bearishDays: number;
  failedDays: number;
  tfStats: Record<string, { total: number; bullish: number; bearish: number; failed: number }>;
  tfDirectionStats: Record<string, OCCTFDirectionStats>;
  allDays: OCCDayData[];
  lastDay: OCCDayData | null;
}

const TF_CONFIGS = [
  { tf: "M5", minutes: 5 },
  { tf: "M15", minutes: 15 },
  { tf: "M30", minutes: 30 },
  { tf: "H1", minutes: 60 },
];

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30; // 09:30
const MARKET_CLOSE = 16 * 60;

function evaluateOCC(bars5min: CandleBar[], tfMinutes: number): OCCTimeframeResult {
  const tf = TF_CONFIGS.find((t) => t.minutes === tfMinutes)?.tf || `M${tfMinutes}`;

  const endMinute = IB_START + tfMinutes * 2;
  const relevantBars = bars5min.filter((b) => {
    const [h, m] = b.time.split(":").map(Number);
    const totalMin = h * 60 + m;
    return totalMin >= IB_START && totalMin < endMinute;
  });

  const candles = aggregateBars(relevantBars, tfMinutes);

  if (candles.length < 2) {
    return { tf, tfMinutes, candle1: null, candle2: null, status: "failed" };
  }

  const c1 = candles[0];
  const c2 = candles[1];

  const c1Bullish = c1.close > c1.open;
  const c1Bearish = c1.close < c1.open;
  const c2Bullish = c2.close > c2.open;
  const c2Bearish = c2.close < c2.open;

  let status: OCCStatus = "failed";
  if (c1Bullish && c2Bullish) status = "bullish";
  else if (c1Bearish && c2Bearish) status = "bearish";

  return { tf, tfMinutes, candle1: c1, candle2: c2, status };
}

function getOverallBias(timeframes: OCCTimeframeResult[]): OCCStatus {
  let bullish = 0;
  let bearish = 0;
  for (const tf of timeframes) {
    if (tf.status === "bullish") bullish++;
    else if (tf.status === "bearish") bearish++;
  }
  if (bullish > bearish) return "bullish";
  if (bearish > bullish) return "bearish";
  return "failed";
}

export function analyzeOCC(bars: BarData[], maxDays: number = 0, _bodyRatio: number = 0.50, weekdays: number[] = [1,2,3,4,5]): OCCResult {
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
  dates = dates.filter(d => {
    const day = new Date(d + "T12:00:00").getDay();
    return weekdays.includes(day);
  });

  const allDays: OCCDayData[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Full day bars for chart (09:30-16:00)
    const fullDayBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });

    if (fullDayBars.length < 6) continue; // need at least 30 min of data

    const bars5min: CandleBar[] = fullDayBars.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const timeframes = TF_CONFIGS.map((cfg) => evaluateOCC(bars5min, cfg.minutes));
    const overallBias = getOverallBias(timeframes);

    allDays.push({ date, bars: bars5min, timeframes, overallBias });
  }

  // TF-level stats
  const tfStats: Record<string, { total: number; bullish: number; bearish: number; failed: number }> = {};
  const tfDirectionStats: Record<string, OCCTFDirectionStats> = {};
  for (const cfg of TF_CONFIGS) {
    tfStats[cfg.tf] = { total: 0, bullish: 0, bearish: 0, failed: 0 };
    tfDirectionStats[cfg.tf] = {
      bullishFirst: { total: 0, valid: 0, invalid: 0 },
      bearishFirst: { total: 0, valid: 0, invalid: 0 },
    };
  }
  for (const day of allDays) {
    for (const tf of day.timeframes) {
      const s = tfStats[tf.tf];
      if (s) {
        s.total++;
        s[tf.status]++;
      }
      // Direction stats: based on first candle color
      const ds = tfDirectionStats[tf.tf];
      if (ds && tf.candle1) {
        const firstIsBullish = tf.candle1.close > tf.candle1.open;
        const firstIsBearish = tf.candle1.close < tf.candle1.open;
        if (firstIsBullish) {
          ds.bullishFirst.total++;
          if (tf.status === "bullish") ds.bullishFirst.valid++;
          else ds.bullishFirst.invalid++;
        } else if (firstIsBearish) {
          ds.bearishFirst.total++;
          if (tf.status === "bearish") ds.bearishFirst.valid++;
          else ds.bearishFirst.invalid++;
        }
      }
    }
  }

  return {
    totalDays: allDays.length,
    bullishDays: allDays.filter((d) => d.overallBias === "bullish").length,
    bearishDays: allDays.filter((d) => d.overallBias === "bearish").length,
    failedDays: allDays.filter((d) => d.overallBias === "failed").length,
    tfStats,
    tfDirectionStats,
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
