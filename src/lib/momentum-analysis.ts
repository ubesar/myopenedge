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

/**
 * Klasifikasi candle berdasarkan body ratio terhadap SMA15 body
 * (mengikuti logika Pine Script "Momentum Candle"):
 *  - super_bull  : body > superMult × avgBody, close > open  (Lime/Neon Green)
 *  - super_bear  : body > superMult × avgBody, close < open  (Magenta/Ungu)
 *  - above_bull  : avgBody < body ≤ superMult × avgBody, close > open
 *  - above_bear  : avgBody < body ≤ superMult × avgBody, close < open
 *  - below       : body ≤ avgBody (lemah/konsolidasi)
 *  - none        : tidak cukup data SMA15 (belum 15 candle sebelumnya)
 */
export type MomentumClass =
  | "super_bull"
  | "super_bear"
  | "above_bull"
  | "above_bear"
  | "below"
  | "none";

export interface MomentumOpenDay {
  date: string;
  /** Candle pembuka NY 09:30 ET (M15) */
  openCandle: CandleBar;
  body: number;
  avgBody: number;
  bodyRatio: number; // body / avgBody
  classification: MomentumClass;
  /** Follow-through: pergerakan setelah candle pembuka sampai 12:00 ET */
  followThrough: {
    /** Net move = close 11:45 - open 09:30 */
    netMove: number;
    /** True jika arah follow-through searah dengan candle pembuka */
    confirmed: boolean | null; // null kalau bukan candle berarah
    /** Range high/low sesi pagi (09:30–12:00) */
    morningHigh: number;
    morningLow: number;
  };
  // ---- Backward-compat fields (dipakai CustomAnalysis & DayChart lama) ----
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  trades: never[]; // tidak ada trade simulation lagi
  dayPnl: number; // = netMove (proxy bias arah hari itu)
}

export interface MomentumClassStats {
  count: number;
  pct: number;
  followConfirmed: number;
  followFailed: number;
  followRate: number; // confirmed / (confirmed+failed)
  avgFollowMove: number;
  avgBodyRatio: number;
}

export interface MomentumResult {
  totalDays: number;
  ibWindowMinutes: number;
  superMult: number;
  smaPeriod: number;
  /** Distribusi tipe candle pembuka 09:30 */
  classStats: Record<Exclude<MomentumClass, "none">, MomentumClassStats>;
  /** Bias arah keseluruhan candle pembuka */
  bullishOpens: number; // super_bull + above_bull
  bearishOpens: number; // super_bear + above_bear
  weakOpens: number; // below
  /** Follow-through saat super candle terbentuk */
  superFollowRate: number; // gabungan super_bull + super_bear
  /** Hari-hari per klasifikasi */
  allDays: MomentumOpenDay[];
  lastDay: MomentumOpenDay | null;

  // ---- Backward-compat fields untuk Index.tsx & history ----
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  netPnl: number;
  maxDrawdown: number;
  highFirst: { total: number; trades: number; wins: number; winRate: number };
  lowFirst: { total: number; trades: number; wins: number; winRate: number };
  // legacy params (dipakai context AI lama)
  lookback: number;
  stopLoss: number;
  takeProfit: number;
  grossProfit: number;
  grossLoss: number;
  equityCurve: { trade: number; pnl: number }[];
}

function parseDateTime(dt: string): Date {
  return parse(dt, "yyyy-MM-dd HH:mm:ss", new Date());
}
function getTimeMinutes(dt: Date): number {
  return dt.getHours() * 60 + dt.getMinutes();
}

const IB_START = 9 * 60 + 30;
const NOON = 12 * 60;
const MARKET_CLOSE = 16 * 60;
const SMA_PERIOD = 15;

/**
 * Momentum Candle Scanner @ NY Open (09:30 ET, M15)
 *
 * Untuk tiap hari trading:
 *  1. Aggregate bar M5 menjadi M15.
 *  2. Identifikasi candle pembuka 09:30.
 *  3. Hitung SMA15 body dari 15 candle M15 SEBELUM 09:30 (termasuk pre-market
 *     supaya selalu tersedia datanya).
 *  4. Klasifikasi candle pembuka berdasarkan rasio body vs avgBody.
 *  5. Ukur follow-through sampai 12:00 ET.
 */
export function analyzeMomentum(
  bars: BarData[],
  ibWindowMinutes: number = 60,
  maxDays: number = 0,
  // Param berikut tidak terpakai lagi tapi dipertahankan untuk kompatibilitas signature.
  _lookback: number = 3,
  _stopLoss: number = 2,
  superMultiplier: number = 1.5
): MomentumResult {
  const ibEnd = IB_START + ibWindowMinutes;

  // Group by date
  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    const date = bar.datetime.split(" ")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(bar);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (maxDays > 0) dates = dates.slice(-maxDays);

  // Flatten all bars for cross-day SMA15 prior to NY open (incl. pre-market).
  // We need M15 candles per date; build a global ordered list.
  const allDays: MomentumOpenDay[] = [];

  // counters
  const initStat = (): MomentumClassStats => ({
    count: 0, pct: 0,
    followConfirmed: 0, followFailed: 0, followRate: 0,
    avgFollowMove: 0, avgBodyRatio: 0,
  });
  const classStats: Record<Exclude<MomentumClass, "none">, MomentumClassStats> = {
    super_bull: initStat(),
    super_bear: initStat(),
    above_bull: initStat(),
    above_bear: initStat(),
    below: initStat(),
  };
  const bodyRatioSum: Record<string, number> = { super_bull: 0, super_bear: 0, above_bull: 0, above_bear: 0, below: 0 };
  const followMoveSum: Record<string, number> = { super_bull: 0, super_bear: 0, above_bull: 0, above_bear: 0, below: 0 };

  let bullishOpens = 0, bearishOpens = 0, weakOpens = 0;
  let superConfirmed = 0, superTotal = 0;

  // Backward-compat helpers
  const hfStats = { total: 0, trades: 0, wins: 0, winRate: 0 };
  const lfStats = { total: 0, trades: 0, wins: 0, winRate: 0 };
  let netPnlAcc = 0;
  const equityCurve: { trade: number; pnl: number }[] = [{ trade: 0, pnl: 0 }];

  for (const date of dates) {
    const dayBars = byDate.get(date)!;
    dayBars.sort((a, b) => parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime());

    // Convert all day bars to CandleBar
    const candles5m: CandleBar[] = dayBars.map(b => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open), high: parseFloat(b.high),
      low: parseFloat(b.low), close: parseFloat(b.close),
    }));

    // Aggregate to M15 untuk hari ini
    const m15All = aggregateBars(candles5m, 15);
    if (m15All.length === 0) continue;

    // Cari candle 09:30
    const openCandle = m15All.find(c => c.time === "09:30");
    if (!openCandle) continue;

    // Ambil 15 candle M15 SEBELUM 09:30 untuk SMA body.
    // Gunakan candle pre-market di hari yang sama; jika kurang, ambil dari hari sebelumnya.
    const priorBodies: number[] = [];
    const preMarket = m15All.filter(c => {
      const [h, m] = c.time.split(":").map(Number);
      return h * 60 + m < IB_START;
    });
    for (let i = preMarket.length - 1; i >= 0 && priorBodies.length < SMA_PERIOD; i--) {
      priorBodies.unshift(Math.abs(preMarket[i].close - preMarket[i].open));
    }
    if (priorBodies.length < SMA_PERIOD) {
      // top up dari hari-hari sebelumnya (pakai candle RTH)
      const idx = dates.indexOf(date);
      for (let d = idx - 1; d >= 0 && priorBodies.length < SMA_PERIOD; d--) {
        const prevDayBars = byDate.get(dates[d]);
        if (!prevDayBars) continue;
        const prevSorted = [...prevDayBars].sort((a, b) =>
          parseDateTime(a.datetime).getTime() - parseDateTime(b.datetime).getTime()
        );
        const prevCandles: CandleBar[] = prevSorted.map(b => ({
          time: b.datetime.split(" ")[1].slice(0, 5),
          open: parseFloat(b.open), high: parseFloat(b.high),
          low: parseFloat(b.low), close: parseFloat(b.close),
        }));
        const prevM15 = aggregateBars(prevCandles, 15);
        for (let i = prevM15.length - 1; i >= 0 && priorBodies.length < SMA_PERIOD; i--) {
          priorBodies.unshift(Math.abs(prevM15[i].close - prevM15[i].open));
        }
      }
    }
    if (priorBodies.length === 0) continue;

    const avgBody = priorBodies.reduce((a, b) => a + b, 0) / priorBodies.length;
    const body = Math.abs(openCandle.close - openCandle.open);
    const bodyRatio = avgBody > 0 ? body / avgBody : 0;
    const isBull = openCandle.close > openCandle.open;
    const isBear = openCandle.close < openCandle.open;

    let cls: MomentumClass = "below";
    if (body > superMultiplier * avgBody) {
      cls = isBull ? "super_bull" : isBear ? "super_bear" : "below";
    } else if (body > avgBody) {
      cls = isBull ? "above_bull" : isBear ? "above_bear" : "below";
    } else {
      cls = "below";
    }

    // Morning bars (09:30 – 12:00) untuk follow-through & chart
    const morningBars = candles5m.filter(c => {
      const [h, m] = c.time.split(":").map(Number);
      const tm = h * 60 + m;
      return tm >= IB_START && tm < NOON;
    });
    const morningHigh = morningBars.length ? Math.max(...morningBars.map(b => b.high)) : openCandle.high;
    const morningLow = morningBars.length ? Math.min(...morningBars.map(b => b.low)) : openCandle.low;
    const morningClose = morningBars.length ? morningBars[morningBars.length - 1].close : openCandle.close;
    const netMove = morningClose - openCandle.open;

    let confirmed: boolean | null = null;
    if (cls === "super_bull" || cls === "above_bull") confirmed = netMove > 0;
    else if (cls === "super_bear" || cls === "above_bear") confirmed = netMove < 0;

    // Stats accumulation
    classStats[cls].count++;
    bodyRatioSum[cls] += bodyRatio;
    followMoveSum[cls] += Math.abs(netMove);
    if (confirmed === true) classStats[cls].followConfirmed++;
    else if (confirmed === false) classStats[cls].followFailed++;

    if (cls === "super_bull" || cls === "above_bull") bullishOpens++;
    else if (cls === "super_bear" || cls === "above_bear") bearishOpens++;
    else weakOpens++;

    if (cls === "super_bull" || cls === "super_bear") {
      superTotal++;
      if (confirmed === true) superConfirmed++;
    }

    // Backward-compat: IB high/low first (untuk DayChart lama)
    const ibBars = dayBars.filter(b => {
      const tm = getTimeMinutes(parseDateTime(b.datetime));
      return tm >= IB_START && tm < ibEnd;
    });
    let ibHigh = -Infinity, ibLow = Infinity;
    for (const b of ibBars) {
      const h = parseFloat(b.high), l = parseFloat(b.low);
      if (h > ibHigh) ibHigh = h;
      if (l < ibLow) ibLow = l;
    }
    if (!Number.isFinite(ibHigh)) ibHigh = openCandle.high;
    if (!Number.isFinite(ibLow)) ibLow = openCandle.low;
    let firstHigh = "", firstLow = "";
    for (const b of ibBars) {
      if (!firstHigh && parseFloat(b.high) >= ibHigh) firstHigh = b.datetime;
      if (!firstLow && parseFloat(b.low) <= ibLow) firstLow = b.datetime;
    }
    const highFirstFormed = !!firstHigh && !!firstLow
      ? parseDateTime(firstHigh).getTime() < parseDateTime(firstLow).getTime()
      : isBull;

    if (highFirstFormed) hfStats.total++;
    else lfStats.total++;
    if (confirmed === true) {
      if (highFirstFormed) { hfStats.trades++; hfStats.wins++; }
      else { lfStats.trades++; lfStats.wins++; }
    } else if (confirmed === false) {
      if (highFirstFormed) hfStats.trades++;
      else lfStats.trades++;
    }

    netPnlAcc += netMove;
    equityCurve.push({ trade: equityCurve.length, pnl: netPnlAcc });

    // Full RTH bars untuk chart
    const fullBars = candles5m.filter(c => {
      const [h, m] = c.time.split(":").map(Number);
      const tm = h * 60 + m;
      return tm >= IB_START && tm < MARKET_CLOSE;
    });

    allDays.push({
      date,
      openCandle,
      body,
      avgBody,
      bodyRatio,
      classification: cls,
      followThrough: {
        netMove,
        confirmed,
        morningHigh,
        morningLow,
      },
      bars: fullBars,
      ibHigh,
      ibLow,
      highFirstFormed,
      trades: [] as never[],
      dayPnl: netMove,
    });
  }

  const totalDays = allDays.length || 1;
  for (const k of Object.keys(classStats) as Array<Exclude<MomentumClass, "none">>) {
    const s = classStats[k];
    s.pct = (s.count / totalDays) * 100;
    const followTotal = s.followConfirmed + s.followFailed;
    s.followRate = followTotal > 0 ? (s.followConfirmed / followTotal) * 100 : 0;
    s.avgBodyRatio = s.count > 0 ? bodyRatioSum[k] / s.count : 0;
    s.avgFollowMove = s.count > 0 ? followMoveSum[k] / s.count : 0;
  }

  const totalTrades = hfStats.trades + lfStats.trades;
  const wins = hfStats.wins + lfStats.wins;
  const losses = totalTrades - wins;
  hfStats.winRate = hfStats.trades > 0 ? (hfStats.wins / hfStats.trades) * 100 : 0;
  lfStats.winRate = lfStats.trades > 0 ? (lfStats.wins / lfStats.trades) * 100 : 0;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  return {
    totalDays: allDays.length,
    ibWindowMinutes,
    superMult: superMultiplier,
    smaPeriod: SMA_PERIOD,
    classStats,
    bullishOpens,
    bearishOpens,
    weakOpens,
    superFollowRate: superTotal > 0 ? (superConfirmed / superTotal) * 100 : 0,
    allDays,
    lastDay: allDays.length > 0 ? allDays[allDays.length - 1] : null,

    // backward-compat
    totalTrades,
    wins,
    losses,
    winRate,
    profitFactor: losses > 0 ? wins / losses : wins > 0 ? Infinity : 0,
    expectancy: totalTrades > 0 ? netPnlAcc / totalTrades : 0,
    netPnl: netPnlAcc,
    maxDrawdown: 0,
    highFirst: hfStats,
    lowFirst: lfStats,
    lookback: SMA_PERIOD,
    stopLoss: 0,
    takeProfit: 0,
    grossProfit: 0,
    grossLoss: 0,
    equityCurve,
  };
}

// Re-export type alias yang lama agar import lain tidak break
export type MomentumTrade = {
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  direction: "buy" | "sell";
  exitReason: "tp" | "sl" | "eod";
  pnl: number;
  cumPnl: number;
};

export type MomentumDayData = MomentumOpenDay;
