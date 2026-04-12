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

/** a single momentum trade */
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

/** per-day result */
export interface MomentumDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  trades: MomentumTrade[];
  dayPnl: number;
  momentum: "bullish" | "bearish" | "neutral";
}

export interface MomentumResult {
  totalDays: number;
  bullishDays: number;
  bearishDays: number;
  neutralDays: number;
  ibWindowMinutes: number;
  lookback: number;
  stopLoss: number;
  takeProfit: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  maxDrawdown: number;
  buyTrades: number;
  buyWins: number;
  buyWinRate: number;
  sellTrades: number;
  sellWins: number;
  sellWinRate: number;
  highFirst: { total: number; bullish: number; bearish: number; neutral: number };
  lowFirst: { total: number; bullish: number; bearish: number; neutral: number };
  allDays: MomentumDayData[];
  lastDay: MomentumDayData | null;
  allTrades: MomentumTrade[];
  cumulativePnl: { trade: number; pnl: number }[];
  dailyPnl: { date: string; pnl: number }[];
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}

function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30; // 09:30 ET
const MARKET_CLOSE = 16 * 60; // 16:00 ET

/**
 * IBKR N-Candle Breakout Momentum Strategy
 * Reference: interactivebrokers.com/campus/ibkr-quant-news/candlestick-trading-a-momentum-strategy-with-example
 *
 * Rules:
 * 1. compute rolling high of last N candles and rolling low of last N candles
 * 2. if current close > N-candle high → BUY signal
 * 3. if current close < N-candle low → SELL signal
 * 4. once in position, check SL and TP each candle
 *    - buy: SL if price drops to entry - SL, TP if price rises to entry + TP
 *    - sell: SL if price rises to entry + SL, TP if price drops to entry - TP
 * 5. only one position at a time; close at EOD if still open
 * 6. trades only start AFTER IB window ends (IB is used for context/bias)
 */
function runStrategy(
  candles: CandleBar[],
  lookback: number,
  stopLoss: number,
  takeProfit: number,
  ibEndIndex: number
): MomentumTrade[] {
  const trades: MomentumTrade[] = [];
  if (candles.length <= lookback) return trades;

  let position: { direction: "buy" | "sell"; entryPrice: number; entryTime: string } | null = null;

  // start scanning from max(lookback, ibEndIndex) so we have enough history AND are past IB
  const startIdx = Math.max(lookback, ibEndIndex);

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];

    // check exit if in position
    if (position) {
      let exitReason: "tp" | "sl" | null = null;
      let exitPrice = 0;

      if (position.direction === "buy") {
        if (c.low <= position.entryPrice - stopLoss) {
          exitReason = "sl";
          exitPrice = position.entryPrice - stopLoss;
        } else if (c.high >= position.entryPrice + takeProfit) {
          exitReason = "tp";
          exitPrice = position.entryPrice + takeProfit;
        }
      } else {
        if (c.high >= position.entryPrice + stopLoss) {
          exitReason = "sl";
          exitPrice = position.entryPrice + stopLoss;
        } else if (c.low <= position.entryPrice - takeProfit) {
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
          exitTime: c.time,
          exitPrice,
          exitReason,
          pnl,
          isWin: pnl > 0,
        });
        position = null;
      }
    }

    // check entry if flat
    if (!position) {
      let nHigh = -Infinity;
      let nLow = Infinity;
      for (let j = i - lookback; j < i; j++) {
        if (candles[j].high > nHigh) nHigh = candles[j].high;
        if (candles[j].low < nLow) nLow = candles[j].low;
      }

      if (c.close > nHigh) {
        position = { direction: "buy", entryPrice: c.close, entryTime: c.time };
      } else if (c.close < nLow) {
        position = { direction: "sell", entryPrice: c.close, entryTime: c.time };
      }
    }
  }

  // close open position at EOD
  if (position && candles.length > 0) {
    const last = candles[candles.length - 1];
    const pnl = position.direction === "buy"
      ? last.close - position.entryPrice
      : position.entryPrice - last.close;
    trades.push({
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      direction: position.direction,
      exitTime: last.time,
      exitPrice: last.close,
      exitReason: "eod",
      pnl,
      isWin: pnl > 0,
    });
  }

  return trades;
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

  // group bars by date
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

    // compute IB range
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

    // determine which formed first
    let firstHighTouch = "", firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }
    const highFirstFormed = parseDateTime(firstHighTouch).getTime() < parseDateTime(firstLowTouch).getTime();

    // full session bars as CandleBar (5min)
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

    // find IB end index (first candle AFTER IB window)
    const ibEndIndex = bars5min.findIndex(b => {
      const [hh, mm] = b.time.split(":").map(Number);
      return hh * 60 + mm >= ibEnd;
    });

    const trades = runStrategy(bars5min, lookback, stopLoss, takeProfit, ibEndIndex >= 0 ? ibEndIndex : 0);
    const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);

    const momentum: "bullish" | "bearish" | "neutral" =
      trades.length === 0 ? "neutral" :
      dayPnl > 0 ? "bullish" : dayPnl < 0 ? "bearish" : "neutral";

    allDays.push({ date, bars: bars5min, ibHigh, ibLow, highFirstFormed, trades, dayPnl, momentum });
  }

  // aggregate
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

  // max drawdown
  let peak = 0, dd = 0, maxDD = 0;
  let cum = 0;
  for (const t of allTrades) {
    cum += t.pnl;
    if (cum > peak) peak = cum;
    dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }

  // direction stats
  const buyArr = allTrades.filter(t => t.direction === "buy");
  const sellArr = allTrades.filter(t => t.direction === "sell");

  // cumulative pnl
  let cumPnl = 0;
  const cumulativePnl = allTrades.map((_, i) => {
    cumPnl += allTrades[i].pnl;
    return { trade: i + 1, pnl: parseFloat(cumPnl.toFixed(2)) };
  });

  // daily pnl
  const dailyPnl = allDays.map(d => ({ date: d.date, pnl: parseFloat(d.dayPnl.toFixed(2)) }));

  // highFirst/lowFirst breakdown
  const hfDays = allDays.filter(d => d.highFirstFormed);
  const lfDays = allDays.filter(d => !d.highFirstFormed);
  const countMomentum = (arr: MomentumDayData[]) => ({
    total: arr.length,
    bullish: arr.filter(d => d.momentum === "bullish").length,
    bearish: arr.filter(d => d.momentum === "bearish").length,
    neutral: arr.filter(d => d.momentum === "neutral").length,
  });

  return {
    totalDays: allDays.length,
    bullishDays: allDays.filter(d => d.momentum === "bullish").length,
    bearishDays: allDays.filter(d => d.momentum === "bearish").length,
    neutralDays: allDays.filter(d => d.momentum === "neutral").length,
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
    maxDrawdown: parseFloat(maxDD.toFixed(2)),
    buyTrades: buyArr.length,
    buyWins: buyArr.filter(t => t.isWin).length,
    buyWinRate: buyArr.length > 0 ? (buyArr.filter(t => t.isWin).length / buyArr.length) * 100 : 0,
    sellTrades: sellArr.length,
    sellWins: sellArr.filter(t => t.isWin).length,
    sellWinRate: sellArr.length > 0 ? (sellArr.filter(t => t.isWin).length / sellArr.length) * 100 : 0,
    highFirst: countMomentum(hfDays),
    lowFirst: countMomentum(lfDays),
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
    allTrades,
    cumulativePnl,
    dailyPnl,
  };
}
