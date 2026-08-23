/**
 * IVFG — Inverse Fair Value Gap backtest engine (MyOpenEdge).
 *
 * Ported from the IVFG_EA NinjaScript strategy.
 *
 * FAIR VALUE GAP (3-candle imbalance), evaluated on the working timeframe:
 *   A = bar[i-2], B = bar[i-1] (displacement candle), C = bar[i]
 *   bullish fvg: high[A] < low[C]  -> zone = [high[A], low[C]]
 *   bearish fvg: low[A]  > high[C] -> zone = [high[C], low[A]]
 *
 * MOMENTUM FILTER (shared "Momentum Candle" super-body rule):
 *   body > SMA(body, period) * multiplier, with a direction.
 *   By default the displacement candle B must be a super-body momentum candle.
 *
 * INVERSION (IFVG):
 *   a bullish fvg inverts when a later bar CLOSES below the zone bottom
 *   -> the zone flips to resistance (short signal).
 *   a bearish fvg inverts when a later bar CLOSES above the zone top
 *   -> the zone flips to support (long signal).
 *   By default the inverting candle must itself be a momentum candle.
 *
 * ENTRY MODES:
 *   immediate  — enter at the close of the inverting candle.
 *   wait retest — wait up to `retestExpiryBars` for price to wick back into the
 *                 flipped zone and get rejected.
 *
 * RISK: fixed dollar risk per trade (default $300); shares = risk / (entry–sl).
 * TP = reward multiple × risk distance. Zone formation and inversion tracking run
 * around the clock; only NEW ENTRIES are gated by the session window. Open
 * positions are closed at the session close.
 */

import { computeMomentumFlags, MOMENTUM_SMA_PERIOD, SUPER_BODY_MULT } from "./momentum-candle";

export interface IvfgInputBar {
  /** "YYYY-MM-DD HH:mm:ss" in exchange time */
  datetime: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
}

export interface IvfgCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type IvfgOutcome = "target" | "stop" | "close";
export type IvfgSide = "both" | "long" | "short";

export interface IvfgZoneInfo {
  top: number;
  bottom: number;
  /** the original fvg direction, before it inverted */
  originBullish: boolean;
  formedTime: string;
  invertedTime: string;
}

export interface IvfgTrade {
  date: string;
  direction: "long" | "short";
  entryTime: string;
  entryPrice: number;
  stopLoss: number;
  target: number;
  exitTime: string;
  exitPrice: number;
  shares: number;
  riskPerShare: number;
  pnlUsd: number;
  rMultiple: number;
  outcome: IvfgOutcome;
  zone: IvfgZoneInfo;
  /** session bars of the trade day, for charting */
  bars: IvfgCandle[];
}

export interface IvfgStats {
  totalDays: number;
  tradedDays: number;
  zonesFormed: number;
  zonesInverted: number;
  longTrades: number;
  shortTrades: number;
  longNetPnl: number;
  shortNetPnl: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancyR: number;
  maxDrawdown: number;
  equityCurve: number[];
}

export interface IvfgOptions {
  /** momentum SMA period (default 15) */
  avgBodyPeriod?: number;
  /** super-body multiplier (default 1.5) */
  momentumMultiplier?: number;
  /** displacement candle must be a momentum candle (default true) */
  requireMomentumCandle?: boolean;
  /** the inverting candle must be a momentum candle (default true) */
  requireMomentumOnInversion?: boolean;
  /** minimum gap size in price units (default 0.05) */
  minGap?: number;
  /** drop a zone that never inverted after N bars (default 50) */
  maxZoneAgeBars?: number;
  /** entry must occur at a local extreme (default true) */
  requireExtremeConfirmation?: boolean;
  /** lookback for the extreme check (default 10) */
  extremeLookback?: number;
  /** wait for a retest instead of entering immediately (default true) */
  waitForRetest?: boolean;
  /** retest window in bars (default 10) */
  retestExpiryBars?: number;
  /** stop buffer in price units (default 0) */
  stopBuffer?: number;
  /** reward multiple, R:R (default 1) */
  rewardMultiple?: number;
  /** fixed dollar risk per trade (default 300) */
  riskUsd?: number;
  /** daily realized profit target — stop new entries once reached, 0 = off */
  dailyTarget?: number;
  side?: IvfgSide;
  /** entry session window in minutes from midnight (default 09:30–16:00) */
  sessionStartMin?: number;
  sessionEndMin?: number;
  maxDays?: number;
}

export interface IvfgResult extends IvfgStats {
  symbol: string;
  side: IvfgSide;
  riskUsd: number;
  rewardMultiple: number;
  sessionStartMin: number;
  sessionEndMin: number;
  waitForRetest: boolean;
  trades: IvfgTrade[];
}

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));
const pad2 = (n: number) => String(n).padStart(2, "0");
const label = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

function minutesOf(datetime: string): number {
  const t = datetime.split(" ")[1] ?? datetime.split("T")[1] ?? "00:00:00";
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface Bar {
  date: string;
  min: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function normalize(bars: IvfgInputBar[]): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const dt = String(b.datetime).replace("T", " ");
    const date = dt.split(" ")[0];
    if (!date) continue;
    const o = num(b.open), h = num(b.high), l = num(b.low), c = num(b.close);
    if (![o, h, l, c].every((v) => isFinite(v))) continue;
    const min = minutesOf(dt);
    out.push({ date, min, time: label(min), open: o, high: h, low: l, close: c });
  }
  out.sort((a, b) => (a.date === b.date ? a.min - b.min : a.date.localeCompare(b.date)));
  return out;
}

interface Zone {
  top: number;
  bottom: number;
  isBullish: boolean;
  formedIdx: number;
  formedTime: string;
  inverted: boolean;
  invertedIdx: number;
  invertedTime: string;
  traded: boolean;
}

export function runIvfgBacktest(
  symbol: string,
  inputBars: IvfgInputBar[],
  options: IvfgOptions = {}
): IvfgResult {
  const avgBodyPeriod = options.avgBodyPeriod ?? MOMENTUM_SMA_PERIOD;
  const momentumMultiplier = options.momentumMultiplier ?? SUPER_BODY_MULT;
  const requireMomentumCandle = options.requireMomentumCandle ?? true;
  const requireMomentumOnInversion = options.requireMomentumOnInversion ?? true;
  const minGap = options.minGap ?? 0.05;
  const maxZoneAgeBars = options.maxZoneAgeBars ?? 50;
  const requireExtremeConfirmation = options.requireExtremeConfirmation ?? true;
  const extremeLookback = options.extremeLookback ?? 10;
  const waitForRetest = options.waitForRetest ?? true;
  const retestExpiryBars = options.retestExpiryBars ?? 10;
  const stopBuffer = options.stopBuffer ?? 0;
  const rewardMultiple = options.rewardMultiple ?? 1;
  const riskUsd = options.riskUsd ?? 300;
  const dailyTarget = options.dailyTarget ?? 0;
  const side: IvfgSide = options.side ?? "both";
  const sessionStartMin = options.sessionStartMin ?? 9 * 60 + 30;
  const sessionEndMin = options.sessionEndMin ?? 16 * 60;

  const all = normalize(inputBars);

  // limit to the most recent N trading days, but keep the series continuous
  let days = Array.from(new Set(all.map((b) => b.date))).sort();
  if (options.maxDays && options.maxDays > 0 && days.length > options.maxDays) {
    days = days.slice(days.length - options.maxDays);
  }
  const dayset = new Set(days);
  const bars = all.filter((b) => dayset.has(b.date));

  const flags = computeMomentumFlags(bars, avgBodyPeriod, momentumMultiplier);
  const sessionBarsByDay = new Map<string, IvfgCandle[]>();
  for (const b of bars) {
    if (b.min < sessionStartMin || b.min >= sessionEndMin) continue;
    if (!sessionBarsByDay.has(b.date)) sessionBarsByDay.set(b.date, []);
    sessionBarsByDay.get(b.date)!.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close });
  }

  const trades: IvfgTrade[] = [];
  let zones: Zone[] = [];
  let zonesFormed = 0;
  let zonesInverted = 0;

  // open position state
  let pos: {
    direction: "long" | "short";
    date: string;
    entryTime: string;
    entryPrice: number;
    stopLoss: number;
    target: number;
    shares: number;
    riskPerShare: number;
    zone: IvfgZoneInfo;
  } | null = null;

  let dailyRealized = 0;
  let currentDay = "";

  const closePosition = (b: Bar, price: number, outcome: IvfgOutcome) => {
    if (!pos) return;
    const pnlUsd = pos.shares * (pos.direction === "long" ? price - pos.entryPrice : pos.entryPrice - price);
    trades.push({
      date: pos.date,
      direction: pos.direction,
      entryTime: pos.entryTime,
      entryPrice: pos.entryPrice,
      stopLoss: pos.stopLoss,
      target: pos.target,
      exitTime: b.time,
      exitPrice: price,
      shares: pos.shares,
      riskPerShare: pos.riskPerShare,
      pnlUsd,
      rMultiple: riskUsd > 0 ? pnlUsd / riskUsd : 0,
      outcome,
      zone: pos.zone,
      bars: sessionBarsByDay.get(pos.date) ?? [],
    });
    dailyRealized += pnlUsd;
    pos = null;
  };

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];

    // new trading day -> reset the daily target accumulator
    if (b.date !== currentDay) {
      // any position left open from the previous day exits at its last bar
      if (pos && i > 0) closePosition(bars[i - 1], bars[i - 1].close, "close");
      currentDay = b.date;
      dailyRealized = 0;
    }

    const inSession = b.min >= sessionStartMin && b.min < sessionEndMin;

    // --- manage the open position first (tp / sl / session close) ---
    if (pos) {
      const hitStop = pos.direction === "long" ? b.low <= pos.stopLoss : b.high >= pos.stopLoss;
      const hitTarget = pos.direction === "long" ? b.high >= pos.target : b.low <= pos.target;
      if (hitStop) closePosition(b, pos.stopLoss, "stop");
      else if (hitTarget) closePosition(b, pos.target, "target");
      else if (b.min >= sessionEndMin - 5) closePosition(b, b.close, "close");
    }

    if (i < 2) continue;

    const a = bars[i - 2];
    const disp = bars[i - 1];
    const sameRun = a.date === b.date || true; // zones may span the overnight series

    const fDisp = flags[i - 1];
    const f0 = flags[i];
    const superBullDisp = !!fDisp?.isSuper && fDisp.direction === "bullish";
    const superBearDisp = !!fDisp?.isSuper && fDisp.direction === "bearish";
    const superBull0 = !!f0?.isSuper && f0.direction === "bullish";
    const superBear0 = !!f0?.isSuper && f0.direction === "bearish";

    // --- 1) detect a newly formed fvg (a / disp / b) ---
    if (sameRun && a.high < b.low && (!requireMomentumCandle || superBullDisp)) {
      if (b.low - a.high >= minGap) {
        zones.push({
          top: b.low, bottom: a.high, isBullish: true,
          formedIdx: i, formedTime: `${b.date} ${b.time}`,
          inverted: false, invertedIdx: -1, invertedTime: "", traded: false,
        });
        zonesFormed++;
      }
    }
    if (sameRun && a.low > b.high && (!requireMomentumCandle || superBearDisp)) {
      if (a.low - b.high >= minGap) {
        zones.push({
          top: a.low, bottom: b.high, isBullish: false,
          formedIdx: i, formedTime: `${b.date} ${b.time}`,
          inverted: false, invertedIdx: -1, invertedTime: "", traded: false,
        });
        zonesFormed++;
      }
    }

    // --- 2) inversion of existing zones ---
    for (const z of zones) {
      if (z.inverted || z.traded) continue;
      if (z.isBullish && b.close < z.bottom) {
        if (!requireMomentumOnInversion || superBear0) {
          z.inverted = true; z.invertedIdx = i; z.invertedTime = `${b.date} ${b.time}`;
          zonesInverted++;
        }
      } else if (!z.isBullish && b.close > z.top) {
        if (!requireMomentumOnInversion || superBull0) {
          z.inverted = true; z.invertedIdx = i; z.invertedTime = `${b.date} ${b.time}`;
          zonesInverted++;
        }
      }
    }

    // --- 3) entries: flat, inside session, daily target not hit ---
    const targetHit = dailyTarget > 0 && dailyRealized >= dailyTarget;
    if (!pos && inSession && !targetHit) {
      for (const z of zones) {
        if (!z.inverted || z.traded) continue;

        const isShort = z.isBullish;  // inverted bullish fvg -> resistance -> short
        const isLong = !z.isBullish;  // inverted bearish fvg -> support -> long
        if (isShort && side === "long") continue;
        if (isLong && side === "short") continue;

        let trigger = false;
        if (!waitForRetest) {
          trigger = z.invertedIdx === i;
        } else {
          const age = i - z.invertedIdx;
          if (age > retestExpiryBars) { z.traded = true; continue; }
          if (age > 0) {
            trigger = isShort
              ? b.high >= z.bottom && b.close < z.bottom
              : b.low <= z.top && b.close > z.top;
          }
        }
        if (!trigger) continue;

        if (requireExtremeConfirmation) {
          const from = Math.max(0, i - extremeLookback + 1);
          const window = bars.slice(from, i + 1);
          const ok = isShort
            ? b.high >= Math.max(...window.map((x) => x.high))
            : b.low <= Math.min(...window.map((x) => x.low));
          if (!ok) continue;
        }

        const entryPrice = b.close;
        const stopLoss = isShort
          ? Math.max(z.top, b.high) + stopBuffer
          : Math.min(z.bottom, b.low) - stopBuffer;
        const riskPerShare = Math.abs(entryPrice - stopLoss);
        if (!(riskPerShare > 0)) continue;

        const target = isShort
          ? entryPrice - riskPerShare * rewardMultiple
          : entryPrice + riskPerShare * rewardMultiple;

        pos = {
          direction: isShort ? "short" : "long",
          date: b.date,
          entryTime: b.time,
          entryPrice,
          stopLoss,
          target,
          shares: riskUsd / riskPerShare,
          riskPerShare,
          zone: {
            top: z.top,
            bottom: z.bottom,
            originBullish: z.isBullish,
            formedTime: z.formedTime,
            invertedTime: z.invertedTime,
          },
        };
        z.traded = true;
        break; // only one new entry per bar
      }
    }

    // --- 4) cleanup stale zones ---
    zones = zones.filter((z) =>
      !z.traded &&
      !(!z.inverted && i - z.formedIdx > maxZoneAgeBars) &&
      !(z.inverted && waitForRetest && i - z.invertedIdx > retestExpiryBars) &&
      !(z.inverted && !waitForRetest && i - z.invertedIdx > 0)
    );
  }

  if (pos && bars.length) closePosition(bars[bars.length - 1], bars[bars.length - 1].close, "close");

  return {
    symbol,
    side,
    riskUsd,
    rewardMultiple,
    sessionStartMin,
    sessionEndMin,
    waitForRetest,
    trades,
    ...computeIvfgStats(trades, days.length, zonesFormed, zonesInverted),
  };
}

export function computeIvfgStats(
  trades: IvfgTrade[],
  totalDays: number,
  zonesFormed = 0,
  zonesInverted = 0,
): IvfgStats {
  const wins = trades.filter((t) => t.pnlUsd > 0);
  const losses = trades.filter((t) => t.pnlUsd < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const netPnl = trades.reduce((s, t) => s + t.pnlUsd, 0);

  let equity = 0, peak = 0, maxDrawdown = 0;
  const equityCurve: number[] = [];
  for (const t of trades) {
    equity += t.pnlUsd;
    equityCurve.push(Math.round(equity * 100) / 100);
    if (equity > peak) peak = equity;
    if (peak - equity > maxDrawdown) maxDrawdown = peak - equity;
  }

  const longs = trades.filter((t) => t.direction === "long");
  const shorts = trades.filter((t) => t.direction === "short");

  return {
    totalDays,
    tradedDays: new Set(trades.map((t) => t.date)).size,
    zonesFormed,
    zonesInverted,
    longTrades: longs.length,
    shortTrades: shorts.length,
    longNetPnl: longs.reduce((s, t) => s + t.pnlUsd, 0),
    shortNetPnl: shorts.reduce((s, t) => s + t.pnlUsd, 0),
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    netPnl,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    expectancyR: trades.length ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length : 0,
    maxDrawdown,
    equityCurve,
  };
}
