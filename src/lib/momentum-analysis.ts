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

/** a single momentum trade signal */
export interface MomentumTrade {
  entryTime: string;
  entryPrice: number;
  direction: "buy" | "sell";
  exitTime: string;
  exitPrice: number;
  exitReason: "tp" | "sl" | "eod";
  pnl: number;
  isWin: boolean;
}

/** per-day analysis result */
export interface MomentumDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  trades: MomentumTrade[];
  dayPnl: number;
  momentum: "bullish" | "bearish" | "choppy";
  signals: { type: "bullish" | "bearish"; times: [string, string] }[];
  timeframes: MomentumTFResult[];
}

export interface MomentumTFResult {
  tf: string;
  tfMinutes: number;
  momentum: "bullish" | "bearish" | "choppy";
  signals: { type: "bullish" | "bearish"; times: [string, string] }[];
  trades: MomentumTrade[];
  winRate: number;
  totalTrades: number;
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
  lookback: number;
  stopLoss: number;
  takeProfit: number;
  /** overall trade stats */
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  /** by direction */
  buyTrades: number;
  buyWins: number;
  buyWinRate: number;
  sellTrades: number;
  sellWins: number;
  sellWinRate: number;
  highFirst: { total: number; bullish: number; bearish: number; choppy: number };
  lowFirst: { total: number; bullish: number; bearish: number; choppy: number };
  tfStats: Record<string, MomentumTFStats>;
  allDays: MomentumDayData[];
  lastDay: MomentumDayData | null;
  allTrades: MomentumTrade[];
  cumulativePnl: { time: string; pnl: number }[];
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

/**
 * IBKR-style N-candle breakout momentum strategy:
 * - Track rolling high/low of last N candles
 * - Buy when close > N-candle high
 * - Sell when close < N-candle low
 * - Apply SL/TP from entry price
 * - Only one position at a time
 */
function runMomentumStrategy(
  candles: CandleBar[],
  lookback: number,
  stopLoss: number,
  takeProfit: number
): MomentumTrade[] {
  const trades: MomentumTrade[] = [];
  if (candles.length <= lookback) return trades;

  let position: { direction: "buy" | "sell"; entryPrice: number; entryTime: string } | null = null;

  for (let i = lookback; i < candles.length; i++) {
    const curr = candles[i];

    // if in position, check SL/TP
    if (position) {
      let exitReason: "tp" | "sl" | null = null;
      let exitPrice = 0;

      if (position.direction === "buy") {
        if (curr.low <= position.entryPrice - stopLoss) {
          exitReason = "sl";
          exitPrice = position.entryPrice - stopLoss;
        } else if (curr.high >= position.entryPrice + takeProfit) {
          exitReason = "tp";
          exitPrice = position.entryPrice + takeProfit;
        }
      } else {
        if (curr.high >= position.entryPrice + stopLoss) {
          exitReason = "sl";
          exitPrice = position.entryPrice + stopLoss;
        } else if (curr.low <= position.entryPrice - takeProfit) {
          exitReason = "tp";
          exitPrice = position.entryPrice - takeProfit;
        }
      }

      if (exitReason) {
        const pnl = position.direction === "buy"
          ? exitPrice - position.entryPrice
          : position.entryPrice - exitPrice;
        trades.push({
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          direction: position.direction,
          exitTime: curr.time,
          exitPrice,
          exitReason,
          pnl,
          isWin: pnl > 0,
        });
        position = null;
      }
    }

    // if no position, check for new signal
    if (!position) {
      // compute N-candle high/low
      let nHigh = -Infinity;
      let nLow = Infinity;
      for (let j = i - lookback; j < i; j++) {
        if (candles[j].high > nHigh) nHigh = candles[j].high;
        if (candles[j].low < nLow) nLow = candles[j].low;
      }

      if (curr.close > nHigh) {
        position = { direction: "buy", entryPrice: curr.close, entryTime: curr.time };
      } else if (curr.close < nLow) {
        position = { direction: "sell", entryPrice: curr.close, entryTime: curr.time };
      }
    }
  }

  // close open position at end of day
  if (position && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const pnl = position.direction === "buy"
      ? lastCandle.close - position.entryPrice
      : position.entryPrice - lastCandle.close;
    trades.push({
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      direction: position.direction,
      exitTime: lastCandle.time,
      exitPrice: lastCandle.close,
      exitReason: "eod",
      pnl,
      isWin: pnl > 0,
    });
  }

  return trades;
}

function evaluateMomentumTF(
  momentumBars5min: CandleBar[],
  tfMinutes: number,
  lookback: number,
  stopLoss: number,
  takeProfit: number
): MomentumTFResult {
  const tf = TF_CONFIGS.find(t => t.minutes === tfMinutes)?.tf || `M${tfMinutes}`;
  const candles = aggregateBars(momentumBars5min, tfMinutes);
  const trades = runMomentumStrategy(candles, lookback, stopLoss, takeProfit);

  const wins = trades.filter(t => t.isWin).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  // determine overall momentum from net pnl
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const momentum: "bullish" | "bearish" | "choppy" =
    trades.length === 0 ? "choppy" :
    netPnl > 0 ? "bullish" : netPnl < 0 ? "bearish" : "choppy";

  // backward-compatible signals
  const signals = trades.map(t => ({
    type: t.direction === "buy" ? "bullish" as const : "bearish" as const,
    times: [t.entryTime, t.exitTime] as [string, string],
  }));

  return { tf, tfMinutes, momentum, signals, trades, winRate, totalTrades: trades.length };
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

export function analyzeMomentum(
  bars: BarData[],
  ibWindowMinutes: number = 60,
  maxDays: number = 0,
  lookback: number = 3,
  weekdays: number[] = [1, 2, 3, 4, 5],
  stopLoss: number = 2,
  takeProfit: number = 4
): MomentumResult {
  const ibEnd = IB_START + ibWindowMinutes;

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

    // IB calculation
    const ibBars = dayBars.filter(b => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < ibEnd;
    });
    if (ibBars.length < 2) continue;

    let ibHigh = -Infinity, ibLow = Infinity;
    for (const bar of ibBars) {
      const h = parseFloat(bar.high), l = parseFloat(bar.low);
      if (h > ibHigh) ibHigh = h;
      if (l < ibLow) ibLow = l;
    }

    let firstHighTouch = "", firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }
    const highFirstFormed = parseDateTime(firstHighTouch).getTime() < parseDateTime(firstLowTouch).getTime();

    // momentum bars: 09:30–16:00 (full session for strategy)
    const sessionBars = dayBars.filter(b => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });

    const bars5min: CandleBar[] = sessionBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));

    if (bars5min.length === 0) continue;

    // evaluate all timeframes
    const timeframes = TF_CONFIGS.map(cfg =>
      evaluateMomentumTF(bars5min, cfg.minutes, lookback, stopLoss, takeProfit)
    );
    const momentum = getOverallMomentum(timeframes);

    // primary TF trades (M15 default)
    const primaryTf = timeframes.find(t => t.tf === "M15") || timeframes[0];
    const trades = primaryTf.trades;
    const signals = primaryTf.signals;
    const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);

    allDays.push({
      date,
      bars: bars5min,
      ibHigh,
      ibLow,
      highFirstFormed,
      trades,
      dayPnl,
      momentum,
      signals,
      timeframes,
    });
  }

  // aggregate all trades
  const allTrades = allDays.flatMap(d => d.trades);
  const wins = allTrades.filter(t => t.isWin).length;
  const losses = allTrades.length - wins;
  const winRate = allTrades.length > 0 ? (wins / allTrades.length) * 100 : 0;

  const grossProfit = allTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(allTrades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const totalPnl = allTrades.reduce((s, t) => s + t.pnl, 0);

  const winTrades = allTrades.filter(t => t.isWin);
  const lossTrades = allTrades.filter(t => !t.isWin);
  const avgWin = winTrades.length > 0 ? winTrades.reduce((s, t) => s + t.pnl, 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length > 0 ? Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length) : 0;
  const expectancy = allTrades.length > 0 ? totalPnl / allTrades.length : 0;

  // direction stats
  const buyTrades = allTrades.filter(t => t.direction === "buy");
  const sellTrades = allTrades.filter(t => t.direction === "sell");

  // cumulative pnl
  let cumPnl = 0;
  const cumulativePnl = allTrades.map((t, i) => {
    cumPnl += t.pnl;
    return { time: `${i + 1}`, pnl: parseFloat(cumPnl.toFixed(2)) };
  });

  // highFirst/lowFirst
  const highFirstDays = allDays.filter(d => d.highFirstFormed);
  const lowFirstDays = allDays.filter(d => !d.highFirstFormed);

  // per-TF stats
  const tfStats: Record<string, MomentumTFStats> = {};
  for (const cfg of TF_CONFIGS) {
    const hf = { total: 0, bullish: 0, bearish: 0, choppy: 0 };
    const lf = { total: 0, bullish: 0, bearish: 0, choppy: 0 };
    for (const day of allDays) {
      const tfResult = day.timeframes.find(t => t.tf === cfg.tf);
      if (!tfResult) continue;
      if (day.highFirstFormed) { hf.total++; hf[tfResult.momentum]++; }
      else { lf.total++; lf[tfResult.momentum]++; }
    }
    tfStats[cfg.tf] = { highFirst: hf, lowFirst: lf };
  }

  return {
    totalDays: allDays.length,
    bullishDays: allDays.filter(d => d.momentum === "bullish").length,
    bearishDays: allDays.filter(d => d.momentum === "bearish").length,
    choppyDays: allDays.filter(d => d.momentum === "choppy").length,
    ibWindowMinutes,
    lookback,
    stopLoss,
    takeProfit,
    totalTrades: allTrades.length,
    wins,
    losses,
    winRate,
    profitFactor,
    totalPnl,
    avgWin,
    avgLoss,
    expectancy,
    buyTrades: buyTrades.length,
    buyWins: buyTrades.filter(t => t.isWin).length,
    buyWinRate: buyTrades.length > 0 ? (buyTrades.filter(t => t.isWin).length / buyTrades.length) * 100 : 0,
    sellTrades: sellTrades.length,
    sellWins: sellTrades.filter(t => t.isWin).length,
    sellWinRate: sellTrades.length > 0 ? (sellTrades.filter(t => t.isWin).length / sellTrades.length) * 100 : 0,
    highFirst: {
      total: highFirstDays.length,
      bullish: highFirstDays.filter(d => d.momentum === "bullish").length,
      bearish: highFirstDays.filter(d => d.momentum === "bearish").length,
      choppy: highFirstDays.filter(d => d.momentum === "choppy").length,
    },
    lowFirst: {
      total: lowFirstDays.length,
      bullish: lowFirstDays.filter(d => d.momentum === "bullish").length,
      bearish: lowFirstDays.filter(d => d.momentum === "bearish").length,
      choppy: lowFirstDays.filter(d => d.momentum === "choppy").length,
    },
    tfStats,
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
    allTrades,
    cumulativePnl,
  };
}
