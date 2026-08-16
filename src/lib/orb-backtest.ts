/**
 * ORB M15 Pullback — pure TypeScript backtest engine (MyOpenEdge).
 *
 * Rules (revamped):
 *  - Only the FIRST m15 candle of the NY session (09:30–09:45) is scanned.
 *  - That candle must be a momentum candle (super-body SMA mode, or fixed body/range ratio mode).
 *  - Bullish momentum  -> buy limit at the candle midpoint, SL at candle low,
 *                         TP = orb high + 0.5 × range  (risk 0.5R range, reward 1.0 range = RR 1:2)
 *  - Bearish momentum  -> sell limit at the candle midpoint, SL at candle high,
 *                         TP = orb low  − 0.5 × range
 *  - The limit is valid for the next 2 m15 candles only. Not filled = no trade that day.
 *  - Max 1 entry per day. Once filled, the trade runs to TP or SL; still open at session close
 *    -> exit at the closing price.
 *  - Fills / TP / SL are resolved on 5-minute bars; m15 is used only to scan the momentum candle.
 *  - TP and SL touched inside the same 5m bar -> counted as a loss (conservative).
 */

import { computeMomentumFlags, SUPER_BODY_MULT, MOMENTUM_SMA_PERIOD } from "./momentum-candle";

export interface IntradayBar {
  /** "YYYY-MM-DD HH:mm:ss" in exchange time */
  datetime: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
}

export interface OhlcCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type OrbMarket = "us" | "idx";
export type OrbSide = "both" | "long" | "short";
export type OrbMomentumMode = "sma" | "ratio";
export type OrbOutcome = "target" | "stop" | "close" | "no_fill" | "no_setup";

export interface OrbTrade {
  date: string;
  direction: "long" | "short";
  /** the first m15 candle of the session (the orb candle) */
  orbCandle: OhlcCandle;
  /** limit entry level = midpoint of the orb candle */
  midpoint: number;
  stopLoss: number;
  target: number;
  entryTime: string | null;
  entryPrice: number | null;
  exitTime: string | null;
  exitPrice: number | null;
  shares: number;
  riskPerShare: number;
  pnlUsd: number;
  rMultiple: number;
  outcome: OrbOutcome;
  /** m15 bars of the session, for charting */
  bars: OhlcCandle[];
}

export interface OrbStats {
  totalDays: number;
  setupDays: number;
  triggeredDays: number;
  noSetupDays: number;
  noFillDays: number;
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

export interface OrbOptions {
  /** session start in minutes from midnight (default 09:30 NY) */
  sessionStartMin?: number;
  /** session end in minutes from midnight (default 16:00) */
  sessionEndMin?: number;
  momentumMode?: OrbMomentumMode;
  /** body / range threshold for the "ratio" mode (0.5 – 0.7) */
  bodyRatio?: number;
  riskUsd?: number;
  side?: OrbSide;
  maxDays?: number;
}

export interface OrbResult extends OrbStats {
  symbol: string;
  side: OrbSide;
  riskUsd: number;
  momentumMode: OrbMomentumMode;
  bodyRatio: number;
  sessionStartMin: number;
  sessionEndMin: number;
  /** every evaluated day, including no_setup / no_fill */
  trades: OrbTrade[];
  /** only the days that produced a filled position */
  triggered: OrbTrade[];
}

export const ORB_SESSIONS: Record<OrbMarket, { start: number; end: number; label: string }> = {
  us: { start: 9 * 60 + 30, end: 16 * 60, label: "09:30–16:00 ET" },
  idx: { start: 9 * 60, end: 15 * 60 + 50, label: "09:00–15:50 WIB" },
};

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));
const pad2 = (n: number) => String(n).padStart(2, "0");
const label = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

function minutesOf(datetime: string): number {
  const t = datetime.split(" ")[1] ?? datetime.split("T")[1] ?? "00:00:00";
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface Bar5 {
  date: string;
  min: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function normalize(bars: IntradayBar[]): Bar5[] {
  const out: Bar5[] = [];
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

interface M15Bar extends OhlcCandle {
  date: string;
  min: number;
}

/** clock-aligned m15 aggregation (:00 / :15 / :30 / :45) over the whole series */
function toM15(bars: Bar5[]): M15Bar[] {
  const groups = new Map<string, Bar5[]>();
  for (const b of bars) {
    const bucket = Math.floor(b.min / 15) * 15;
    const key = `${b.date} ${bucket}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  return Array.from(groups.entries())
    .map(([key, g]) => {
      const [date, bucketStr] = key.split(" ");
      const bucket = Number(bucketStr);
      return {
        date,
        min: bucket,
        time: label(bucket),
        open: g[0].open,
        high: Math.max(...g.map((x) => x.high)),
        low: Math.min(...g.map((x) => x.low)),
        close: g[g.length - 1].close,
      };
    })
    .sort((a, b) => (a.date === b.date ? a.min - b.min : a.date.localeCompare(b.date)));
}

export function runOrbM15Backtest(
  symbol: string,
  bars: IntradayBar[],
  options: OrbOptions = {}
): OrbResult {
  const sessionStartMin = options.sessionStartMin ?? ORB_SESSIONS.us.start;
  const sessionEndMin = options.sessionEndMin ?? ORB_SESSIONS.us.end;
  const momentumMode: OrbMomentumMode = options.momentumMode ?? "sma";
  const bodyRatio = options.bodyRatio ?? 0.6;
  const riskUsd = options.riskUsd ?? 100;
  const side: OrbSide = options.side ?? "both";
  const maxDays = options.maxDays ?? 0;

  const all = normalize(bars);
  const m15All = toM15(all);
  // continuous SMA across the whole series (pre-market + previous days included)
  const flags = computeMomentumFlags(m15All, MOMENTUM_SMA_PERIOD, SUPER_BODY_MULT);
  const flagOf = new Map<string, (typeof flags)[number]>();
  m15All.forEach((b, i) => flagOf.set(`${b.date} ${b.min}`, flags[i]));

  const byDay = new Map<string, Bar5[]>();
  for (const b of all) {
    if (b.min < sessionStartMin || b.min >= sessionEndMin) continue;
    if (!byDay.has(b.date)) byDay.set(b.date, []);
    byDay.get(b.date)!.push(b);
  }

  let days = Array.from(byDay.keys()).sort();
  if (maxDays > 0 && days.length > maxDays) days = days.slice(days.length - maxDays);

  const trades: OrbTrade[] = [];

  for (const date of days) {
    const dayBars = byDay.get(date)!;
    const sessionM15 = m15All.filter((b) => b.date === date && b.min >= sessionStartMin && b.min < sessionEndMin);
    const orbBucket = Math.floor(sessionStartMin / 15) * 15;
    const orb = m15All.find((b) => b.date === date && b.min === orbBucket);
    if (!orb) continue;

    const range = orb.high - orb.low;
    const body = Math.abs(orb.close - orb.open);
    const direction: "long" | "short" = orb.close >= orb.open ? "long" : "short";

    const flag = flagOf.get(`${date} ${orbBucket}`);
    const isMomentum =
      range > 0 &&
      body > 0 &&
      (momentumMode === "sma" ? !!flag?.isSuper : body / range >= bodyRatio);

    const midpoint = (orb.high + orb.low) / 2;
    const stopLoss = direction === "long" ? orb.low : orb.high;
    const target = direction === "long" ? orb.high + 0.5 * range : orb.low - 0.5 * range;

    const base = {
      date,
      direction,
      orbCandle: { time: orb.time, open: orb.open, high: orb.high, low: orb.low, close: orb.close },
      midpoint,
      stopLoss,
      target,
      shares: 0,
      riskPerShare: 0,
      pnlUsd: 0,
      rMultiple: 0,
      bars: sessionM15.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
    };

    const sideOk = side === "both" || (side === "long" && direction === "long") || (side === "short" && direction === "short");

    if (!isMomentum || !sideOk) {
      trades.push({ ...base, entryTime: null, entryPrice: null, exitTime: null, exitPrice: null, outcome: "no_setup" });
      continue;
    }

    // limit valid for the next 2 m15 candles only
    const fillFrom = orbBucket + 15;
    const fillUntil = orbBucket + 45;

    let entryIdx = -1;
    let entryTime: string | null = null;
    for (let i = 0; i < dayBars.length; i++) {
      const b = dayBars[i];
      if (b.min < fillFrom) continue;
      if (b.min >= fillUntil) break;
      const filled = direction === "long" ? b.low <= midpoint : b.high >= midpoint;
      if (filled) {
        entryIdx = i;
        entryTime = b.time;
        break;
      }
    }

    if (entryIdx < 0) {
      trades.push({ ...base, entryTime: null, entryPrice: null, exitTime: null, exitPrice: null, outcome: "no_fill" });
      continue;
    }

    const riskPerShare = Math.abs(midpoint - stopLoss);
    const shares = riskPerShare > 0 ? riskUsd / riskPerShare : 0;

    let outcome: OrbOutcome = "close";
    let exitTime: string | null = null;
    let exitPrice: number | null = null;

    for (let i = entryIdx; i < dayBars.length; i++) {
      const b = dayBars[i];
      const hitStop = direction === "long" ? b.low <= stopLoss : b.high >= stopLoss;
      const hitTarget = direction === "long" ? b.high >= target : b.low <= target;
      if (hitStop) {
        outcome = "stop"; exitTime = b.time; exitPrice = stopLoss; break;
      }
      if (hitTarget) {
        outcome = "target"; exitTime = b.time; exitPrice = target; break;
      }
    }
    if (exitPrice == null) {
      const last = dayBars[dayBars.length - 1];
      outcome = "close"; exitTime = last.time; exitPrice = last.close;
    }

    const pnlUsd = shares * (direction === "long" ? exitPrice - midpoint : midpoint - exitPrice);

    trades.push({
      ...base,
      entryTime,
      entryPrice: midpoint,
      exitTime,
      exitPrice,
      shares,
      riskPerShare,
      pnlUsd,
      rMultiple: riskUsd > 0 ? pnlUsd / riskUsd : 0,
      outcome,
    });
  }

  return {
    symbol,
    side,
    riskUsd,
    momentumMode,
    bodyRatio,
    sessionStartMin,
    sessionEndMin,
    trades,
    triggered: trades.filter((t) => t.entryPrice != null),
    ...computeOrbStats(trades),
  };
}

export function computeOrbStats(trades: OrbTrade[]): OrbStats {
  const triggered = trades.filter((t) => t.entryPrice != null);
  const wins = triggered.filter((t) => t.pnlUsd > 0);
  const losses = triggered.filter((t) => t.pnlUsd < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const netPnl = triggered.reduce((s, t) => s + t.pnlUsd, 0);

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve: number[] = [];
  for (const t of triggered) {
    equity += t.pnlUsd;
    equityCurve.push(Math.round(equity * 100) / 100);
    if (equity > peak) peak = equity;
    if (peak - equity > maxDrawdown) maxDrawdown = peak - equity;
  }

  const longs = triggered.filter((t) => t.direction === "long");
  const shorts = triggered.filter((t) => t.direction === "short");

  return {
    totalDays: trades.length,
    setupDays: trades.filter((t) => t.outcome !== "no_setup").length,
    triggeredDays: triggered.length,
    noSetupDays: trades.filter((t) => t.outcome === "no_setup").length,
    noFillDays: trades.filter((t) => t.outcome === "no_fill").length,
    longTrades: longs.length,
    shortTrades: shorts.length,
    longNetPnl: longs.reduce((s, t) => s + t.pnlUsd, 0),
    shortNetPnl: shorts.reduce((s, t) => s + t.pnlUsd, 0),
    wins: wins.length,
    losses: losses.length,
    winRate: triggered.length ? (wins.length / triggered.length) * 100 : 0,
    netPnl,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    expectancyR: triggered.length ? triggered.reduce((s, t) => s + t.rMultiple, 0) / triggered.length : 0,
    maxDrawdown,
    equityCurve,
  };
}

/** splits the trade list into `parts` chronological segments with their own metrics */
export function segmentOrbStats(trades: OrbTrade[], parts = 3): { label: string; from: string; to: string; stats: OrbStats }[] {
  if (trades.length === 0) return [];
  const size = Math.ceil(trades.length / parts);
  const out: { label: string; from: string; to: string; stats: OrbStats }[] = [];
  for (let i = 0; i < parts; i++) {
    const slice = trades.slice(i * size, (i + 1) * size);
    if (slice.length === 0) continue;
    out.push({
      label: `segment ${i + 1}`,
      from: slice[0].date,
      to: slice[slice.length - 1].date,
      stats: computeOrbStats(slice),
    });
  }
  return out;
}
