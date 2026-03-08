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

export interface MomentumSignal {
  type: "bullish" | "bearish";
  times: [string, string];
}

export interface MomentumTFResult {
  tf: string;
  tfMinutes: number;
  momentum: "bullish" | "bearish" | "choppy";
  signals: MomentumSignal[];
}

export interface MomentumDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  momentum: "bullish" | "bearish" | "choppy";
  signals: MomentumSignal[];
  timeframes: MomentumTFResult[];
}

export interface MomentumTFStats {
  highFirst: { total: number; bullish: number; bearish: number; choppy: number };
  lowFirst: { total: number; bullish: number; bearish: number; choppy: number };
}

export interface MomentumResult {
  totalDays: number;
  bullishDays: number;
  bearishDays: number;
  choppyDays: number;
  ibWindowMinutes: number;
  highFirst: { total: number; bullish: number; bearish: number; choppy: number };
  lowFirst: { total: number; bullish: number; bearish: number; choppy: number };
  tfStats: Record<string, MomentumTFStats>;
  allDays: MomentumDayData[];
  lastDay: MomentumDayData | null;
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

const IB_START = 9 * 60 + 30;
const NOON = 12 * 60;
const MARKET_CLOSE = 16 * 60;

function detectSignals(candles: CandleBar[], bodyRatio: number = 0.50): MomentumSignal[] {
  const signals: MomentumSignal[] = [];
  let i = 0;
  while (i < candles.length - 1) {
    const prev = candles[i];
    const curr = candles[i + 1];

    const prevBody = Math.abs(prev.close - prev.open);
    const prevRange = prev.high - prev.low;
    const currBody = Math.abs(curr.close - curr.open);
    const currRange = curr.high - curr.low;

    const prevBullish = prev.close >= prev.open;
    const currBullish = curr.close >= curr.open;
    const sameColor = prevBullish === currBullish;

    if (
      prevRange > 0 && currRange > 0 &&
      prevBody / prevRange >= bodyRatio &&
      currBody / currRange >= 0.30 &&
      sameColor
    ) {
      signals.push({
        type: prevBullish ? "bullish" : "bearish",
        times: [prev.time, curr.time],
      });
      i += 2;
    } else {
      i++;
    }
  }
  return signals;
}

function evaluateMomentumTF(momentumBars5min: CandleBar[], tfMinutes: number, bodyRatio: number): MomentumTFResult {
  const tf = TF_CONFIGS.find(t => t.minutes === tfMinutes)?.tf || `M${tfMinutes}`;
  const candles = aggregateBars(momentumBars5min, tfMinutes);
  const signals = detectSignals(candles, bodyRatio);
  const momentum = signals.length > 0 ? signals[0].type : "choppy";
  return { tf, tfMinutes, momentum, signals };
}

function getOverallMomentum(timeframes: MomentumTFResult[]): "bullish" | "bearish" | "choppy" {
  let bullish = 0, bearish = 0;
  for (const tf of timeframes) {
    if (tf.momentum === "bullish") bullish++;
    else if (tf.momentum === "bearish") bearish++;
  }
  if (bullish > bearish) return "bullish";
  if (bearish > bullish) return "bearish";
  return "choppy";
}

export function analyzeMomentum(bars: BarData[], ibWindowMinutes: number = 60, maxDays: number = 0, bodyRatio: number = 0.50): MomentumResult {
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

    // Momentum detection: 09:30-12:00 window, multi-TF
    const momentumBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < NOON;
    });

    const momentumBars5min: CandleBar[] = momentumBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    // Evaluate all 4 timeframes
    const timeframes = TF_CONFIGS.map(cfg => evaluateMomentumTF(momentumBars5min, cfg.minutes));
    const momentum = getOverallMomentum(timeframes);

    // Keep first signal set for backward compat
    const firstTfWithSignal = timeframes.find(tf => tf.signals.length > 0);
    const signals = firstTfWithSignal?.signals || [];

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
      timeframes,
    });
  }

  // Overall highFirst/lowFirst stats (based on overall momentum)
  const highFirstDays = allDays.filter((d) => d.highFirstFormed);
  const lowFirstDays = allDays.filter((d) => !d.highFirstFormed);

  // Per-TF stats
  const tfStats: Record<string, MomentumTFStats> = {};
  for (const cfg of TF_CONFIGS) {
    const hf = { total: 0, bullish: 0, bearish: 0, choppy: 0 };
    const lf = { total: 0, bullish: 0, bearish: 0, choppy: 0 };
    for (const day of allDays) {
      const tfResult = day.timeframes.find(t => t.tf === cfg.tf);
      if (!tfResult) continue;
      if (day.highFirstFormed) {
        hf.total++;
        hf[tfResult.momentum]++;
      } else {
        lf.total++;
        lf[tfResult.momentum]++;
      }
    }
    tfStats[cfg.tf] = { highFirst: hf, lowFirst: lf };
  }

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
    tfStats,
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
