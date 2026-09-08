/**
 * Calendar Monday (ES Monday 06:00 → 16:00 ET)
 * 100% mechanical time-based trade — no indicator, no stop, no target.
 *
 * Rule (frozen):
 *  - only on the configured weekday (default monday); holidays skip themselves
 *  - buy the OPEN of the first bar in [entry, entry + tolerance] ET
 *  - sell the OPEN of the first bar in [exit, exit + tolerance] ET
 *  - if either bar is missing → no trade
 *  - fixed contracts, cost in points per round trip
 */

export interface RawBar {
  datetime: string; // "yyyy-MM-dd HH:mm:ss"
  open: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
}

export interface CalMondayTrade {
  date: string;
  weekday: number;
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  grossPoints: number;
  netPoints: number;
  pnlUsd: number;
  contracts: number;
  outcome: "win" | "loss";
}

export interface CalMondayOptions {
  /** 0=sun … 1=monday (default) */
  weekday?: number;
  /** minutes from midnight, ET */
  entryMin?: number;
  exitMin?: number;
  /** accept the first bar within this many minutes of the target */
  toleranceMin?: number;
  /** round-trip cost, in points */
  costPoints?: number;
  /** dollars per point (ES 50, MES 5, NQ 20, stocks/etf 1) */
  pointValue?: number;
  contracts?: number;
  maxDays?: number;
}

export interface CalMondayResult {
  trades: CalMondayTrade[];
  totalDays: number;
  /** every day in range that matched the weekday, including skipped ones */
  skipped: { date: string; reason: string }[];
}

const num = (v: string | number) => (typeof v === "number" ? v : parseFloat(v));

function minutesOf(dt: string) {
  const t = dt.replace("T", " ").split(" ")[1] ?? "00:00:00";
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function weekdayOf(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export function runCalendarMondayBacktest(
  bars: RawBar[],
  opts: CalMondayOptions = {},
): CalMondayResult {
  const weekday = opts.weekday ?? 1;
  const entryMin = opts.entryMin ?? 6 * 60;
  const exitMin = opts.exitMin ?? 16 * 60;
  const tol = opts.toleranceMin ?? 5;
  const cost = opts.costPoints ?? 0.5;
  const pv = opts.pointValue ?? 1;
  const contracts = opts.contracts ?? 1;

  // group bars by calendar date
  const byDate = new Map<string, { dt: string; min: number; open: number }[]>();
  for (const b of bars) {
    const dt = String(b.datetime).replace("T", " ");
    const date = dt.split(" ")[0];
    const open = num(b.open);
    if (!isFinite(open)) continue;
    const arr = byDate.get(date) ?? [];
    arr.push({ dt, min: minutesOf(dt), open });
    byDate.set(date, arr);
  }

  let dates = Array.from(byDate.keys()).sort();
  if (opts.maxDays && opts.maxDays > 0) dates = dates.slice(-opts.maxDays);

  const trades: CalMondayTrade[] = [];
  const skipped: { date: string; reason: string }[] = [];

  for (const date of dates) {
    if (weekdayOf(date) !== weekday) continue;
    const day = (byDate.get(date) ?? []).sort((a, b) => a.min - b.min);
    const pick = (target: number) => day.find((b) => b.min >= target && b.min <= target + tol);
    const e = pick(entryMin);
    const x = pick(exitMin);
    if (!e || !x || x.min <= e.min) {
      skipped.push({ date, reason: !e ? "no entry bar" : "no exit bar" });
      continue;
    }
    const grossPoints = x.open - e.open;
    const netPoints = grossPoints - cost;
    const pnlUsd = netPoints * pv * contracts;
    trades.push({
      date,
      weekday,
      entryTime: e.dt.split(" ")[1] ?? "",
      entryPrice: e.open,
      exitTime: x.dt.split(" ")[1] ?? "",
      exitPrice: x.open,
      grossPoints,
      netPoints,
      pnlUsd,
      contracts,
      outcome: pnlUsd >= 0 ? "win" : "loss",
    });
  }

  return { trades, totalDays: dates.length, skipped };
}
