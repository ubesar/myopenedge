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

// Opening candle highlight (kept for chart compat)
export interface MomentumSignal {
  type: "bullish" | "bearish";
  times: [string, string];
}

export type MomentumLabel = "bullish" | "bearish" | "neutral";

export interface MomentumTFResult {
  tf: string;
  tfMinutes: number;
  // Result from MCC logic for this TF
  momentum: MomentumLabel; // bullish/bearish if opening had momentum; neutral otherwise
  direction: "bullish" | "bearish" | "none";
  hasMomentum: boolean;
  bodyRatio: number;
  continued: boolean; // session closed same direction as opening
  openingCandle?: CandleBar;
  signals: MomentumSignal[]; // single-element if momentum present (opening candle highlight)
}

export interface MomentumDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  // Default TF (M30) results, surfaced for the day chart
  momentum: MomentumLabel;
  signals: MomentumSignal[];
  continued: boolean;
  sessionOpen: number;
  sessionClose: number;
  timeframes: MomentumTFResult[];
}

// New MCC stats shape (per TF)
export interface MomentumTFStats {
  totalDays: number;
  // Bullish opening with valid momentum
  bullishSignals: number;
  bullishContinued: number;
  bullishReversed: number;
  // Bearish opening with valid momentum
  bearishSignals: number;
  bearishContinued: number;
  bearishReversed: number;
  // Days where opening had no momentum (filtered out)
  neutralDays: number;
}

export interface MomentumResult {
  totalDays: number;
  bullishDays: number;
  bearishDays: number;
  neutralDays: number;
  ibWindowMinutes: number;
  bodyRatioThreshold: number;
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

const DEFAULT_TF = "M30";

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;

/**
 * MCC opening candle evaluation for a given timeframe.
 * - Opening candle = the single aggregated candle starting at 09:30 ET
 * - Direction = green (close>open) or red (close<open)
 * - Momentum valid if |body| / range >= bodyRatio threshold
 * - Continuation = session close (16:00 ET) on the same side as opening close vs open
 */
function evaluateMCC(
  sessionBars5min: CandleBar[],
  tfMinutes: number,
  bodyRatio: number,
  sessionOpen: number,
  sessionClose: number,
  bodyHistory: number[],
  superMultiplier: number,
  avgPeriod: number
): MomentumTFResult {
  const tf = TF_CONFIGS.find(t => t.minutes === tfMinutes)?.tf || `M${tfMinutes}`;
  const candles = aggregateBars(sessionBars5min, tfMinutes);
  const opening = candles[0];

  if (!opening) {
    return {
      tf, tfMinutes, momentum: "neutral", direction: "none",
      hasMomentum: false, bodyRatio: 0, continued: false, signals: [],
    };
  }

  const body = Math.abs(opening.close - opening.open);
  const range = opening.high - opening.low;
  const ratio = range > 0 ? body / range : 0;
  const direction: "bullish" | "bearish" | "none" =
    opening.close > opening.open ? "bullish" :
    opening.close < opening.open ? "bearish" : "none";

  // Push opening body to rolling history (Pine ta.sma includes current bar)
  bodyHistory.push(body);

  // Super/Solid Body Candle: body > sma(body, avgPeriod) * superMultiplier.
  // Warm-up fallback: use body/range ratio threshold.
  let hasMomentum = false;
  if (direction !== "none") {
    if (bodyHistory.length >= avgPeriod) {
      const slice = bodyHistory.slice(-avgPeriod);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      hasMomentum = body > avg * superMultiplier;
    } else {
      hasMomentum = ratio >= bodyRatio;
    }
  }

  // Continuation: session close direction matches opening direction
  const sessionBullish = sessionClose > sessionOpen;
  const continued = hasMomentum && (
    (direction === "bullish" && sessionBullish) ||
    (direction === "bearish" && !sessionBullish)
  );

  const momentum: MomentumLabel = hasMomentum ? direction as "bullish" | "bearish" : "neutral";

  const signals: MomentumSignal[] = hasMomentum
    ? [{ type: direction as "bullish" | "bearish", times: [opening.time, opening.time] }]
    : [];

  return {
    tf, tfMinutes, momentum, direction, hasMomentum,
    bodyRatio: ratio, continued, openingCandle: opening, signals,
  };
}

export function analyzeMomentum(
  bars: BarData[],
  ibWindowMinutes: number = 30,
  maxDays: number = 0,
  bodyRatio: number = 0.70,
  weekdays: number[] = [1, 2, 3, 4, 5],
  superMultiplier: number = 1.5,
  avgPeriod: number = 15
): MomentumResult {
  // Rolling history of opening-candle body sizes per TF across all sessions
  // (Pine ta.sma(BodyRange(), 15) reproduced for the opening candle only).
  const bodyHistoryByTf: Record<string, number[]> = {};
  for (const cfg of TF_CONFIGS) bodyHistoryByTf[cfg.tf] = [];
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

  const allDays: MomentumDayData[] = [];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // IB calculation (for The Tell tracking, kept for chart compat)
    const ibBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < IB_START + ibWindowMinutes;
    });
    if (ibBars.length < 1) continue;

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

    // Full session 09:30 - 16:00
    const sessionRawBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });
    if (sessionRawBars.length === 0) continue;

    const sessionBars5min: CandleBar[] = sessionRawBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    const sessionOpen = sessionBars5min[0].open;
    const sessionClose = sessionBars5min[sessionBars5min.length - 1].close;

    const timeframes = TF_CONFIGS.map(cfg =>
      evaluateMCC(sessionBars5min, cfg.minutes, bodyRatio, sessionOpen, sessionClose, bodyHistoryByTf[cfg.tf], superMultiplier, avgPeriod)
    );

    const defaultTf = timeframes.find(t => t.tf === DEFAULT_TF) || timeframes[0];

    allDays.push({
      date,
      bars: sessionBars5min,
      ibHigh,
      ibLow,
      highFirstFormed,
      momentum: defaultTf.momentum,
      signals: defaultTf.signals,
      continued: defaultTf.continued,
      sessionOpen,
      sessionClose,
      timeframes,
    });
  }

  // Per-TF stats
  const tfStats: Record<string, MomentumTFStats> = {};
  for (const cfg of TF_CONFIGS) {
    const s: MomentumTFStats = {
      totalDays: allDays.length,
      bullishSignals: 0, bullishContinued: 0, bullishReversed: 0,
      bearishSignals: 0, bearishContinued: 0, bearishReversed: 0,
      neutralDays: 0,
    };
    for (const day of allDays) {
      const tfRes = day.timeframes.find(t => t.tf === cfg.tf);
      if (!tfRes) continue;
      if (!tfRes.hasMomentum) {
        s.neutralDays++;
        continue;
      }
      if (tfRes.direction === "bullish") {
        s.bullishSignals++;
        if (tfRes.continued) s.bullishContinued++;
        else s.bullishReversed++;
      } else if (tfRes.direction === "bearish") {
        s.bearishSignals++;
        if (tfRes.continued) s.bearishContinued++;
        else s.bearishReversed++;
      }
    }
    tfStats[cfg.tf] = s;
  }

  return {
    totalDays: allDays.length,
    bullishDays: allDays.filter((d) => d.momentum === "bullish").length,
    bearishDays: allDays.filter((d) => d.momentum === "bearish").length,
    neutralDays: allDays.filter((d) => d.momentum === "neutral").length,
    ibWindowMinutes,
    bodyRatioThreshold: bodyRatio,
    tfStats,
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
