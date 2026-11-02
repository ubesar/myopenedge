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

/** Parses one CSV line `Time,Open,High,Low,Close,...`. Returns [t, open, close] or null. */
export function parseLine(line: string): [number, number, number] | null {
  const p = line.split(",");
  if (p.length < 5) return null;
  const t = parseMinute(p[0].trim());
  const o = parseFloat(p[1]);
  const c = parseFloat(p[4]);
  if (!isFinite(t) || !isFinite(o) || !isFinite(c)) return null;
  return [t, o, c];
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
}

/** Builds per-day minute grids for one weekday (or all weekdays when weekday = -1). */
export function buildDayGrids(s: M1Series, weekday: number): DayGrid[] {
  const map = new Map<number, DayGrid>();
  const get = (day: number) => {
    let g = map.get(day);
    if (!g) {
      g = { day, openAt: new Float32Array(1440).fill(NaN), closeAt: new Float32Array(1440).fill(NaN) };
      map.set(day, g);
    }
    return g;
  };
  for (let i = 0; i < s.t.length; i++) {
    const label = s.t[i];
    const closeDay = Math.floor(label / 1440);
    const wdC = weekdayOf(closeDay);
    if ((weekday === -1 ? wdC >= 1 && wdC <= 5 : wdC === weekday)) {
      get(closeDay).closeAt[label - closeDay * 1440] = s.c[i];
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
}

export interface ScanConfig {
  weekday: number; // -1 = mon–fri
  duration: number; // minutes
  step: number; // minutes
  sessionStart: number; // clock minute
  sessionEnd: number; // clock minute (last allowed exit)
  minTrades: number;
}

export function windowTrades(grids: DayGrid[], start: number, end: number): WindowTrade[] {
  const out: WindowTrade[] = [];
  for (const g of grids) {
    const e = g.openAt[start];
    const x = g.closeAt[end];
    if (isNaN(e) || isNaN(x)) continue;
    out.push({ date: dayLabel(g.day), entry: e, exit: x, points: x - e });
  }
  return out;
}

function stat(start: number, end: number, pts: number[]): WindowStat {
  let wins = 0, net = 0, gw = 0, gl = 0;
  for (const p of pts) {
    net += p;
    if (p > 0) { wins++; gw += p; } else gl -= p;
  }
  const n = pts.length;
  return {
    start, end, trades: n, wins,
    winRate: n ? (wins / n) * 100 : 0,
    net, avg: n ? net / n : 0,
    profitFactor: gl > 0 ? gw / gl : gw > 0 ? Infinity : 0,
  };
}

const rank = (a: WindowStat, b: WindowStat) => b.winRate - a.winRate || b.net - a.net;

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
    const pts = windowTrades(grids, s, e).map((t) => t.points);
    if (pts.length < cfg.minTrades) continue;
    all.push({ start: s, end: e, long: stat(s, e, pts), short: stat(s, e, pts.map((p) => -p)) });
  }
  return {
    days: grids.length,
    all,
    long: all.map((w) => w.long).sort(rank),
    short: all.map((w) => w.short).sort(rank),
  };
}

export const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const parseHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};
