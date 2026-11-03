/**
 * Seasonal Window Optimizer — NinjaTrader M1 CSV.
 *
 * NinjaTrader stamps each bar at its CLOSE time: the bar labelled 09:31 opened
 * at 09:30:00. A window "09:30 → 10:30" therefore enters at the OPEN of the
 * bar labelled 09:31 and exits at the CLOSE of the bar labelled 10:30.
 * Timestamps are expected in US Eastern Time (no shift applied).
 */

export interface M1Series {
  /** minutes since 1970-01-01 of the bar label (ET wall clock treated as UTC) */
  t: Int32Array;
  o: Float32Array;
  /** bar highs (may be missing on datasets imported before h/l support) */
  h?: Float32Array;
  /** bar lows */
  l?: Float32Array;
  c: Float32Array;
}

/** Parses "YYYY-MM-DD HH:MM[:SS]" to minute epoch; NaN if invalid. */
export function parseMinute(s: string): number {
  if (s.length < 16) return NaN;
  const y = +s.slice(0, 4), mo = +s.slice(5, 7), d = +s.slice(8, 10);
  const h = +s.slice(11, 13), mi = +s.slice(14, 16);
  if (!(y > 1900) || !(mo >= 1) || !(d >= 1) || isNaN(h) || isNaN(mi)) return NaN;
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}

/** Parses one CSV line `Time,Open,High,Low,Close,...`. Returns [t, open, high, low, close] or null. */
export function parseLine(line: string): [number, number, number, number, number] | null {
  const p = line.split(",");
  if (p.length < 5) return null;
  const t = parseMinute(p[0].trim());
  const o = parseFloat(p[1]);
  const c = parseFloat(p[4]);
  if (!isFinite(t) || !isFinite(o) || !isFinite(c)) return null;
  const h = parseFloat(p[2]), l = parseFloat(p[3]);
  return [t, o, isFinite(h) ? h : Math.max(o, c), isFinite(l) ? l : Math.min(o, c)];
}

export const WEEKDAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

/** 0 = Sunday … 6 = Saturday for a day index (days since epoch). */
export const weekdayOf = (day: number) => (day + 4) % 7;

export function dayLabel(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

export interface DayGrid {
  day: number;
  /** price at clock minute m (0..1439): open of the bar that OPENED at m */
  openAt: Float32Array;
  /** price at clock minute m: close of the bar that CLOSED at m */
  closeAt: Float32Array;
  /** high of the bar LABELLED minute m (covers m-1 → m) */
  highAt: Float32Array;
  /** low of the bar LABELLED minute m */
  lowAt: Float32Array;
}

/** Builds per-day minute grids for one weekday (or all weekdays when weekday = -1). */
export function buildDayGrids(s: M1Series, weekday: number): DayGrid[] {
  const map = new Map<number, DayGrid>();
  const get = (day: number) => {
    let g = map.get(day);
    if (!g) {
      g = {
        day, openAt: new Float32Array(1440).fill(NaN), closeAt: new Float32Array(1440).fill(NaN),
        highAt: new Float32Array(1440).fill(NaN), lowAt: new Float32Array(1440).fill(NaN),
      };
      map.set(day, g);
    }
    return g;
  };
  const hi = s.h, lo = s.l;
  for (let i = 0; i < s.t.length; i++) {
    const label = s.t[i];
    const closeDay = Math.floor(label / 1440);
    const wdC = weekdayOf(closeDay);
    if ((weekday === -1 ? wdC >= 1 && wdC <= 5 : wdC === weekday)) {
      const g = get(closeDay);
      const m = label - closeDay * 1440;
      g.closeAt[m] = s.c[i];
      g.highAt[m] = hi && isFinite(hi[i]) ? hi[i] : Math.max(s.o[i], s.c[i]);
      g.lowAt[m] = lo && isFinite(lo[i]) ? lo[i] : Math.min(s.o[i], s.c[i]);
    }
    const openMin = label - 1;
    const openDay = Math.floor(openMin / 1440);
    const wdO = weekdayOf(openDay);
    if ((weekday === -1 ? wdO >= 1 && wdO <= 5 : wdO === weekday)) {
      get(openDay).openAt[openMin - openDay * 1440] = s.o[i];
    }
  }
  return Array.from(map.values()).sort((a, b) => a.day - b.day);
}

export interface WindowTrade {
  date: string;
  entry: number;
  exit: number;
  points: number; // long points (exit - entry)
  /** worst adverse excursion in points, long direction (entry - lowest low) */
  mae: number;
  /** best favorable excursion in points, long direction (highest high - entry) */
  mfe: number;
}

export interface WindowStat {
  start: number; // clock minute
  end: number;
  trades: number;
  wins: number;
  winRate: number;
  net: number;
  avg: number;
  profitFactor: number;
  avgMae: number;
  maxMae: number;
  avgMfe: number;
  maxMfe: number;
}

export type RankBy = "winRate" | "net" | "avg" | "profitFactor";

export interface ScanConfig {
  weekday: number; // -1 = mon–fri
  duration: number; // minutes
  step: number; // minutes
  sessionStart: number; // clock minute
  sessionEnd: number; // clock minute (last allowed exit)
  minTrades: number;
  rankBy: RankBy;
}

/** MAE/MFE over the bars labelled start+1 … end (the minutes the position is open). */
function excursion(g: DayGrid, start: number, end: number, entry: number): { mae: number; mfe: number } {
  let lo = Infinity, hi = -Infinity;
  for (let m = start + 1; m <= end; m++) {
    const h = g.highAt[m], l = g.lowAt[m];
    if (isFinite(h) && h > hi) hi = h;
    if (isFinite(l) && l < lo) lo = l;
  }
  if (!isFinite(lo) || !isFinite(hi)) return { mae: 0, mfe: 0 };
  return {
    mae: Math.max(entry - lo, 0), // long adverse
    mfe: Math.max(hi - entry, 0), // long favorable
  };
}

export function windowTrades(grids: DayGrid[], start: number, end: number): WindowTrade[] {
  const out: WindowTrade[] = [];
  for (const g of grids) {
    const e = g.openAt[start];
    const x = g.closeAt[end];
    if (isNaN(e) || isNaN(x)) continue;
    const { mae, mfe } = excursion(g, start, end, e);
    out.push({ date: dayLabel(g.day), entry: e, exit: x, points: x - e, mae, mfe });
  }
  return out;
}

function stat(start: number, end: number, pts: number[], maes: number[], mfes: number[]): WindowStat {
  let wins = 0, net = 0, gw = 0, gl = 0, sMae = 0, xMae = 0, sMfe = 0, xMfe = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    net += p;
    if (p > 0) { wins++; gw += p; } else gl -= p;
    const a = maes[i], f = mfes[i];
    sMae += a; if (a > xMae) xMae = a;
    sMfe += f; if (f > xMfe) xMfe = f;
  }
  const n = pts.length;
  return {
    start, end, trades: n, wins,
    winRate: n ? (wins / n) * 100 : 0,
    net, avg: n ? net / n : 0,
    profitFactor: gl > 0 ? gw / gl : gw > 0 ? Infinity : 0,
    avgMae: n ? sMae / n : 0,
    maxMae: xMae,
    avgMfe: n ? sMfe / n : 0,
    maxMfe: xMfe,
  };
}

const RANKERS: Record<RankBy, (a: WindowStat, b: WindowStat) => number> = {
  winRate: (a, b) => b.winRate - a.winRate || b.net - a.net,
  net: (a, b) => b.net - a.net || b.winRate - a.winRate,
  avg: (a, b) => b.avg - a.avg || b.net - a.net,
  profitFactor: (a, b) => b.profitFactor - a.profitFactor || b.net - a.net,
};

export const RANK_LABELS: Record<RankBy, string> = {
  winRate: "win rate",
  net: "total poin",
  avg: "rata-rata poin",
  profitFactor: "profit factor",
};

export interface ScanResult {
  days: number;
  long: WindowStat[]; // all windows ranked for long
  short: WindowStat[]; // all windows ranked for short
  all: { start: number; end: number; long: WindowStat; short: WindowStat }[];
}

export function scanWindows(grids: DayGrid[], cfg: ScanConfig): ScanResult {
  const all: ScanResult["all"] = [];
  for (let s = cfg.sessionStart; s + cfg.duration <= cfg.sessionEnd; s += cfg.step) {
    const e = s + cfg.duration;
    const ts = windowTrades(grids, s, e);
    if (ts.length < cfg.minTrades) continue;
    const pts = ts.map((t) => t.points);
    const maes = ts.map((t) => t.mae);
    const mfes = ts.map((t) => t.mfe);
    // short: adverse = long favorable, favorable = long adverse
    all.push({ start: s, end: e, long: stat(s, e, pts, maes, mfes), short: stat(s, e, pts.map((p) => -p), mfes, maes) });
  }
  const rk = RANKERS[cfg.rankBy] ?? RANKERS.winRate;
  return {
    days: grids.length,
    all,
    long: all.map((w) => w.long).sort(rk),
    short: all.map((w) => w.short).sort(rk),
  };
}

// ============ consistency breakdown ============

export interface PeriodStat {
  label: string;
  trades: number;
  wins: number;
  winRate: number;
  net: number;
  avg: number;
}

function periodStat(label: string, trades: WindowTrade[]): PeriodStat {
  let wins = 0, net = 0;
  for (const t of trades) { net += t.points; if (t.points > 0) wins++; }
  const n = trades.length;
  return { label, trades: n, wins, winRate: n ? (wins / n) * 100 : 0, net, avg: n ? net / n : 0 };
}

/** Year-by-year performance of one window/side (trades must be one direction). */
export function yearlyBreakdown(trades: WindowTrade[]): PeriodStat[] {
  const byYear = new Map<string, WindowTrade[]>();
  for (const t of trades) {
    const y = t.date.slice(0, 4);
    let a = byYear.get(y);
    if (!a) { a = []; byYear.set(y, a); }
    a.push(t);
  }
  return Array.from(byYear.keys()).sort().map((y) => periodStat(y, byYear.get(y)!));
}

/** In-sample vs out-of-sample: chronological first half vs second half. */
export function walkForwardSplit(trades: WindowTrade[]): { first: PeriodStat; second: PeriodStat } {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.ceil(sorted.length / 2);
  return { first: periodStat("paruh 1 (is)", sorted.slice(0, mid)), second: periodStat("paruh 2 (oos)", sorted.slice(mid)) };
}

/** Cumulative net points over chronological trades (for the equity curve). */
export function equityCurve(trades: WindowTrade[]): { i: number; date: string; cum: number; pts: number }[] {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  return sorted.map((t, i) => {
    cum += t.points;
    return { i: i + 1, date: t.date, cum: Math.round(cum * 100) / 100, pts: t.points };
  });
}

export const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const parseHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};
