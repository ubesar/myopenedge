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

export interface MomentumTrade {
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  direction: "buy" | "sell";
  exitReason: "tp" | "sl" | "eod";
  pnl: number;
  cumPnl: number;
}

export interface MomentumDayData {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  trades: MomentumTrade[];
  dayPnl: number;
}

export interface MomentumResult {
  totalDays: number;
  ibWindowMinutes: number;
  lookback: number;
  stopLoss: number;
  takeProfit: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  maxDrawdown: number;
  equityCurve: { trade: number; pnl: number }[];
  highFirst: { total: number; trades: number; wins: number; winRate: number };
  lowFirst: { total: number; trades: number; wins: number; winRate: number };
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
const MARKET_CLOSE = 16 * 60;

/**
 * IBKR N-Candle Breakout Momentum Strategy
 * 
 * After IB window ends, on each 5-min bar:
 * - Calculate the highest high and lowest low of the previous N candles
 * - Buy signal: Close > N-candle high
 * - Sell signal: Close < N-candle low
 * - Apply Stop Loss and Take Profit
 * - Only one position at a time; close at EOD if still open
 */
export function analyzeMomentum(
  bars: BarData[],
  ibWindowMinutes: number = 60,
  maxDays: number = 0,
  lookback: number = 3,
  stopLoss: number = 2,
  takeProfit: number = 5
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

  const allDays: MomentumDayData[] = [];
  let cumPnl = 0;
  const equityCurve: { trade: number; pnl: number }[] = [{ trade: 0, pnl: 0 }];
  let tradeCount = 0;

  // global stats
  let totalTrades = 0, wins = 0, losses = 0;
  let grossProfit = 0, grossLoss = 0;
  let peak = 0, maxDrawdown = 0;

  // high/low first stats
  const hfStats = { total: 0, trades: 0, wins: 0, winRate: 0 };
  const lfStats = { total: 0, trades: 0, wins: 0, winRate: 0 };

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // IB calculation
    const ibBars = dayBars.filter((b) => {
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

    // Determine high/low first formed
    let firstHighTouch = "", firstLowTouch = "";
    for (const bar of ibBars) {
      if (!firstHighTouch && parseFloat(bar.high) >= ibHigh) firstHighTouch = bar.datetime;
      if (!firstLowTouch && parseFloat(bar.low) <= ibLow) firstLowTouch = bar.datetime;
    }
    const highFirstFormed = parseDateTime(firstHighTouch).getTime() < parseDateTime(firstLowTouch).getTime();

    // Trading bars: after IB ends until market close
    const tradingBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= ibEnd && m < MARKET_CLOSE;
    });

    if (tradingBars.length < lookback + 1) {
      // Full day bars for chart display
      const fullBars = dayBars.filter((b) => {
        const m = getTimeMinutes(parseDateTime(b.datetime));
        return m >= IB_START && m < MARKET_CLOSE;
      });
      if (fullBars.length > 0) {
        allDays.push({
          date, bars: fullBars.map(b => ({
            time: b.datetime.split(" ")[1].slice(0, 5),
            open: parseFloat(b.open), high: parseFloat(b.high),
            low: parseFloat(b.low), close: parseFloat(b.close),
          })),
          ibHigh, ibLow, highFirstFormed, trades: [], dayPnl: 0,
        });
        if (highFirstFormed) hfStats.total++;
        else lfStats.total++;
      }
      continue;
    }

    // Convert trading bars to CandleBar
    const candles: CandleBar[] = tradingBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open), high: parseFloat(b.high),
      low: parseFloat(b.low), close: parseFloat(b.close),
    }));

    // N-Candle Breakout Strategy
    const trades: MomentumTrade[] = [];
    let position: { direction: "buy" | "sell"; entryPrice: number; entryTime: string } | null = null;
    let dayPnl = 0;

    for (let i = lookback; i < candles.length; i++) {
      const curr = candles[i];
      const prevN = candles.slice(i - lookback, i);
      const nHigh = Math.max(...prevN.map(c => c.high));
      const nLow = Math.min(...prevN.map(c => c.low));
      const isLastBar = i === candles.length - 1;

      if (position) {
        // Check exit conditions
        let exitReason: "tp" | "sl" | "eod" | null = null;
        let exitPrice = curr.close;

        if (position.direction === "buy") {
          if (curr.low <= position.entryPrice - stopLoss) {
            exitReason = "sl";
            exitPrice = position.entryPrice - stopLoss;
          } else if (curr.high >= position.entryPrice + takeProfit) {
            exitReason = "tp";
            exitPrice = position.entryPrice + takeProfit;
          } else if (isLastBar) {
            exitReason = "eod";
            exitPrice = curr.close;
          }
        } else {
          if (curr.high >= position.entryPrice + stopLoss) {
            exitReason = "sl";
            exitPrice = position.entryPrice + stopLoss;
          } else if (curr.low <= position.entryPrice - takeProfit) {
            exitReason = "tp";
            exitPrice = position.entryPrice - takeProfit;
          } else if (isLastBar) {
            exitReason = "eod";
            exitPrice = curr.close;
          }
        }

        if (exitReason) {
          const pnl = position.direction === "buy"
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
          cumPnl += pnl;
          dayPnl += pnl;
          tradeCount++;

          trades.push({
            entryTime: position.entryTime,
            entryPrice: position.entryPrice,
            exitTime: curr.time,
            exitPrice,
            direction: position.direction,
            exitReason,
            pnl,
            cumPnl,
          });

          totalTrades++;
          if (pnl > 0) { wins++; grossProfit += pnl; }
          else { losses++; grossLoss += Math.abs(pnl); }

          if (highFirstFormed) { hfStats.trades++; if (pnl > 0) hfStats.wins++; }
          else { lfStats.trades++; if (pnl > 0) lfStats.wins++; }

          equityCurve.push({ trade: tradeCount, pnl: cumPnl });
          if (cumPnl > peak) peak = cumPnl;
          const dd = peak - cumPnl;
          if (dd > maxDrawdown) maxDrawdown = dd;

          position = null;
        }
      }

      // Check entry signals (only if no position)
      if (!position && !isLastBar) {
        if (curr.close > nHigh) {
          position = { direction: "buy", entryPrice: curr.close, entryTime: curr.time };
        } else if (curr.close < nLow) {
          position = { direction: "sell", entryPrice: curr.close, entryTime: curr.time };
        }
      }
    }

    // Full day bars for chart
    const fullBars = dayBars.filter((b) => {
      const m = getTimeMinutes(parseDateTime(b.datetime));
      return m >= IB_START && m < MARKET_CLOSE;
    });

    if (highFirstFormed) hfStats.total++;
    else lfStats.total++;

    allDays.push({
      date,
      bars: fullBars.map(b => ({
        time: b.datetime.split(" ")[1].slice(0, 5),
        open: parseFloat(b.open), high: parseFloat(b.high),
        low: parseFloat(b.low), close: parseFloat(b.close),
      })),
      ibHigh, ibLow, highFirstFormed, trades, dayPnl,
    });
  }

  hfStats.winRate = hfStats.trades > 0 ? (hfStats.wins / hfStats.trades) * 100 : 0;
  lfStats.winRate = lfStats.trades > 0 ? (lfStats.wins / lfStats.trades) * 100 : 0;

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const expectancy = totalTrades > 0 ? cumPnl / totalTrades : 0;

  return {
    totalDays: allDays.length,
    ibWindowMinutes,
    lookback,
    stopLoss,
    takeProfit,
    totalTrades,
    wins,
    losses,
    winRate,
    profitFactor,
    expectancy,
    grossProfit,
    grossLoss,
    netPnl: cumPnl,
    maxDrawdown,
    equityCurve,
    highFirst: hfStats,
    lowFirst: lfStats,
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,
  };
}
