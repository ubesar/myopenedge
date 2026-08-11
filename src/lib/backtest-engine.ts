/**
 * backtest-engine.ts — realistic execution modelling + risk-adjusted analytics.
 *
 * Lookahead policy:
 *  - every signal comes from CLOSED bars only (C1 must be closed before the
 *    stop order exists, C2 pullback is evaluated on the bar after C1).
 *  - stop / limit fills are only accepted when the bar range actually touches
 *    the price; market fills use the NEXT bar open.
 *  - the analysis always runs over a static historical snapshot, so a re-run
 *    over the same snapshot produces identical output (no repaint).
 */

import type { NYOrbDay, NYOrbTrade } from "./ny-orb-m15";

export interface ExecConfig {
  tickSize: number;
  tickValue: number;
  slippageTicks: number;
  commissionPerTrade: number;
  commissionPerContract: number;
  fixedRiskUsd: number;
  accountSize: number;
  riskFreeRatePct: number;
}

export const DEFAULT_EXEC: ExecConfig = {
  tickSize: 0.25,
  tickValue: 5,
  slippageTicks: 1,
  commissionPerTrade: 0,
  commissionPerContract: 2.5,
  fixedRiskUsd: 100,
  accountSize: 25000,
  riskFreeRatePct: 4,
};

export interface ExecTrade {
  date: string;
  side: "long" | "short";
  entryTime: string;
  exitTime: string;
  signalTime: string;
  rawEntry: number;
  entry: number;
  rawExit: number;
  exit: number;
  stop: number;
  target: number;
  size: number;
  riskPoints: number;
  grossPnl: number;
  commission: number;
  slippageCost: number;
  netPnl: number;
  rMultiple: number;
  holdMinutes: number;
  outcome: "win" | "loss" | "open";
  reason: string;
}

const pointValue = (c: ExecConfig) => (c.tickSize > 0 ? c.tickValue / c.tickSize : 1);
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Apply slippage + commission to raw strategy trades. */
export function buildExecTrades(days: NYOrbDay[], cfg: ExecConfig): ExecTrade[] {
  const pv = pointValue(cfg);
  const slip = cfg.slippageTicks * cfg.tickSize;
  const out: ExecTrade[] = [];

  for (const d of days) {
    const t: NYOrbTrade | undefined = d.trade;
    if (!t) continue;
    if (t.outcome !== "win" && t.outcome !== "loss" && t.outcome !== "open") continue;

    const long = t.side === "long";
    const dir = long ? 1 : -1;

    // stop-order entry: filled worse than the trigger by the slippage assumption
    const entry = t.entry + dir * slip;

    const lastBar = d.bars[d.bars.length - 1];
    let rawExit: number;
    if (t.outcome === "win") rawExit = t.target;
    else if (t.outcome === "loss") rawExit = t.stop;
    else rawExit = lastBar ? lastBar.close : t.entry;

    // exit slippage is always adverse
    const exit = t.outcome === "win" ? rawExit - dir * slip : rawExit - dir * slip;

    const riskPoints = Math.abs(entry - t.stop);
    if (riskPoints <= 0) continue;

    const size = Math.max(1, Math.round(cfg.fixedRiskUsd / (riskPoints * pv)));
    const grossPnlRaw = (t.rawExitOverride ?? 0, (rawExit - t.entry) * dir * size * pv);
    const grossPnl = grossPnlRaw;
    const commission = cfg.commissionPerTrade + 2 * cfg.commissionPerContract * size;
    const slippageCost = 2 * slip * size * pv;
    const netPnl = (exit - entry) * dir * size * pv - commission;

    const entryTime = t.c2Time;
    const exitTime = t.exitTime ?? lastBar?.time ?? t.c2Time;

    out.push({
      date: d.date,
      side: t.side,
      signalTime: t.c1Time,
      entryTime,
      exitTime,
      rawEntry: t.entry,
      entry,
      rawExit,
      exit,
      stop: t.stop,
      target: t.target,
      size,
      riskPoints,
      grossPnl,
      commission,
      slippageCost,
      netPnl,
      rMultiple: netPnl / cfg.fixedRiskUsd,
      holdMinutes: Math.max(0, toMin(exitTime) - toMin(entryTime)),
      outcome: t.outcome,
      reason: `c1 momentum ${t.side} @${t.c1Time} → stop order ${long ? "buy" : "sell"} ${t.entry.toFixed(2)}, sl ${t.stop.toFixed(2)}, tp 0.5 ext ${t.target.toFixed(2)}`,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.entryTime.localeCompare(b.entryTime));
}

export interface EquityPoint {
  i: number;
  date: string;
  equity: number;
  gross: number;
  pctReturn: number;
  drawdown: number;
}

export interface RiskMetrics {
  n: number;
  wins: number;
  losses: number;
  winRate: number;
  grossPnl: number;
  netPnl: number;
  costTotal: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxDdDurationDays: number;
  maxDdDurationTrades: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  recoveryFactor: number;
  cagr: number;
  longestWinStreak: number;
  longestLossStreak: number;
  years: number;
  equity: EquityPoint[];
}

const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

export function computeRiskMetrics(trades: ExecTrade[], cfg: ExecConfig): RiskMetrics {
  const n = trades.length;
  const equity: EquityPoint[] = [];
  let eq = cfg.accountSize;
  let gr = cfg.accountSize;
  let peak = cfg.accountSize;
  let peakDate = trades[0]?.date ?? "";
  let peakIdx = 0;
  let maxDd = 0;
  let maxDdDays = 0;
  let maxDdTrades = 0;
  const rets: number[] = [];

  trades.forEach((t, i) => {
    const prev = eq;
    eq += t.netPnl;
    gr += t.grossPnl;
    rets.push(prev > 0 ? t.netPnl / prev : 0);
    if (eq > peak) {
      peak = eq;
      peakDate = t.date;
      peakIdx = i;
    } else {
      maxDdDays = Math.max(maxDdDays, daysBetween(peakDate, t.date));
      maxDdTrades = Math.max(maxDdTrades, i - peakIdx);
    }
    maxDd = Math.max(maxDd, peak - eq);
    equity.push({
      i: i + 1,
      date: t.date,
      equity: eq,
      gross: gr,
      pctReturn: ((eq - cfg.accountSize) / cfg.accountSize) * 100,
      drawdown: eq - peak,
    });
  });

  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl <= 0);
  const grossWin = wins.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.netPnl, 0));

  const netPnl = eq - cfg.accountSize;
  const grossPnl = gr - cfg.accountSize;

  const spanDays = n > 1 ? daysBetween(trades[0].date, trades[n - 1].date) : 0;
  const years = Math.max(spanDays / 365, 1 / 365);
  const tradesPerYear = n > 0 ? n / years : 0;

  const mean = n > 0 ? rets.reduce((a, r) => a + r, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1)) : 0;
  const downside = rets.filter((r) => r < 0);
  const dd = downside.length
    ? Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / downside.length)
    : 0;

  const rfPerTrade = tradesPerYear > 0 ? cfg.riskFreeRatePct / 100 / tradesPerYear : 0;
  const ann = Math.sqrt(Math.max(1, tradesPerYear));
  const sharpe = sd > 0 ? ((mean - rfPerTrade) / sd) * ann : 0;
  const sortino = dd > 0 ? ((mean - rfPerTrade) / dd) * ann : 0;

  const finalEq = cfg.accountSize + netPnl;
  const cagr = finalEq > 0 && years > 0 ? ((finalEq / cfg.accountSize) ** (1 / years) - 1) * 100 : 0;
  const maxDdPct = peak > 0 ? (maxDd / cfg.accountSize) * 100 : 0;

  let ws = 0, ls = 0, bestW = 0, bestL = 0;
  for (const t of trades) {
    if (t.netPnl > 0) { ws++; ls = 0; } else { ls++; ws = 0; }
    bestW = Math.max(bestW, ws);
    bestL = Math.max(bestL, ls);
  }

  return {
    n,
    wins: wins.length,
    losses: losses.length,
    winRate: n ? (wins.length / n) * 100 : 0,
    grossPnl,
    netPnl,
    costTotal: trades.reduce((a, t) => a + t.commission + t.slippageCost, 0),
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    expectancy: n ? netPnl / n : 0,
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
    maxDdDurationDays: maxDdDays,
    maxDdDurationTrades: maxDdTrades,
    sharpe,
    sortino,
    calmar: maxDdPct > 0 ? cagr / maxDdPct : 0,
    recoveryFactor: maxDd > 0 ? netPnl / maxDd : 0,
    cagr,
    longestWinStreak: bestW,
    longestLossStreak: bestL,
    years,
    equity,
  };
}

/** Buy & hold benchmark from the session snapshot (close-to-close of the ORB sessions). */
export function buyAndHoldCurve(days: NYOrbDay[], cfg: ExecConfig) {
  const pts: { date: string; pct: number; equity: number }[] = [];
  const first = days.find((d) => d.bars.length > 0);
  if (!first) return pts;
  const base = first.bars[0].open;
  for (const d of days) {
    if (!d.bars.length) continue;
    const c = d.bars[d.bars.length - 1].close;
    const pct = ((c - base) / base) * 100;
    pts.push({ date: d.date, pct, equity: cfg.accountSize * (1 + pct / 100) });
  }
  return pts;
}

export interface MonteCarloResult {
  runs: number;
  netP5: number;
  netP50: number;
  netP95: number;
  ddP5: number;
  ddP50: number;
  ddP95: number;
  ruinPct: number;
  histogram: { bucket: string; count: number }[];
}

export function monteCarlo(trades: ExecTrade[], cfg: ExecConfig, runs = 1000): MonteCarloResult | null {
  if (trades.length < 5) return null;
  const pnls = trades.map((t) => t.netPnl);
  const nets: number[] = [];
  const dds: number[] = [];
  let ruin = 0;

  for (let r = 0; r < runs; r++) {
    const arr = pnls.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    let eq = cfg.accountSize, peak = cfg.accountSize, dd = 0;
    for (const p of arr) {
      eq += p;
      peak = Math.max(peak, eq);
      dd = Math.max(dd, peak - eq);
    }
    if (dd >= cfg.accountSize * 0.5) ruin++;
    nets.push(eq - cfg.accountSize);
    dds.push(dd);
  }

  const pct = (a: number[], p: number) => {
    const s = a.slice().sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  };

  const min = Math.min(...nets), max = Math.max(...nets);
  const buckets = 16;
  const step = (max - min) / buckets || 1;
  const histogram = Array.from({ length: buckets }, (_, i) => ({
    bucket: `${Math.round(min + i * step)}`,
    count: nets.filter((v) => v >= min + i * step && v < min + (i + 1) * step).length,
  }));

  return {
    runs,
    netP5: pct(nets, 5), netP50: pct(nets, 50), netP95: pct(nets, 95),
    ddP5: pct(dds, 5), ddP50: pct(dds, 50), ddP95: pct(dds, 95),
    ruinPct: (ruin / runs) * 100,
    histogram,
  };
}

/** Market regime per session, derived only from already-closed sessions. */
export type Regime = "trending up" | "trending down" | "sideways" | "high volatility";

export function classifyRegimes(days: NYOrbDay[]): Map<string, Regime> {
  const map = new Map<string, Regime>();
  const closes = days.map((d) => (d.bars.length ? d.bars[d.bars.length - 1].close : NaN));
  const ranges = days.map((d) => d.orbSize);
  const avgRange = ranges.reduce((a, r) => a + r, 0) / (ranges.length || 1);

  days.forEach((d, i) => {
    if (i < 5 || !Number.isFinite(closes[i])) {
      map.set(d.date, "sideways");
      return;
    }
    const past = closes[i - 5];
    const chg = ((closes[i] - past) / past) * 100;
    if (ranges[i] > avgRange * 1.5) map.set(d.date, "high volatility");
    else if (chg > 1) map.set(d.date, "trending up");
    else if (chg < -1) map.set(d.date, "trending down");
    else map.set(d.date, "sideways");
  });
  return map;
}

export function summarize(trades: ExecTrade[]) {
  const n = trades.length;
  const net = trades.reduce((a, t) => a + t.netPnl, 0);
  const wins = trades.filter((t) => t.netPnl > 0).length;
  let eq = 0, peak = 0, dd = 0;
  for (const t of trades) {
    eq += t.netPnl;
    peak = Math.max(peak, eq);
    dd = Math.max(dd, peak - eq);
  }
  return { n, net, wins, winRate: n ? (wins / n) * 100 : 0, maxDd: dd };
}

export const REPAINT_INDICATORS: string[] = [];
