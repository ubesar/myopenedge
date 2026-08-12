/**
 * Risk-adjusted metrics, robustness tooling (monte carlo, walk-forward,
 * out-of-sample split, parameter sensitivity) and benchmark helpers for the
 * backtester. All functions are pure so results are reproducible.
 */

export interface MetricTrade {
  date: string;
  pnlNet: number;
  pnlGross: number;
}

export interface AdvancedMetrics {
  trades: number;
  grossPnl: number;
  netPnl: number;
  costTotal: number;
  maxDrawdown: number;
  maxDrawdownDurationTrades: number;
  maxDrawdownDurationDays: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  recoveryFactor: number;
  cagr: number;
  longestWinStreak: number;
  longestLossStreak: number;
  years: number;
  finalEquity: number;
}

const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

const daysBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000));

export function computeAdvancedMetrics(
  trades: MetricTrade[],
  initialCapital: number,
  riskFreeRate = 0,
): AdvancedMetrics {
  const empty: AdvancedMetrics = {
    trades: 0, grossPnl: 0, netPnl: 0, costTotal: 0, maxDrawdown: 0,
    maxDrawdownDurationTrades: 0, maxDrawdownDurationDays: 0, sharpe: 0, sortino: 0,
    calmar: 0, recoveryFactor: 0, cagr: 0, longestWinStreak: 0, longestLossStreak: 0,
    years: 0, finalEquity: initialCapital,
  };
  if (trades.length === 0) return empty;

  const capital = initialCapital > 0 ? initialCapital : 10000;
  const grossPnl = trades.reduce((s, t) => s + t.pnlGross, 0);
  const netPnl = trades.reduce((s, t) => s + t.pnlNet, 0);

  // equity path + per-trade percentage returns (compounding on running equity)
  let equity = capital;
  let peak = capital;
  let peakIdx = 0;
  let peakDate = trades[0].date;
  let maxDD = 0;
  let ddTrades = 0;
  let ddDays = 0;
  const rets: number[] = [];

  trades.forEach((t, i) => {
    rets.push(t.pnlNet / Math.max(equity, 1));
    equity += t.pnlNet;
    if (equity >= peak) {
      peak = equity;
      peakIdx = i;
      peakDate = t.date;
    } else {
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
      const durT = i - peakIdx;
      if (durT > ddTrades) ddTrades = durT;
      const durD = daysBetween(peakDate, t.date);
      if (durD > ddDays) ddDays = durD;
    }
  });

  const meanRet = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = std(rets);
  const downside = rets.filter((r) => r < 0);
  const dsd = downside.length
    ? Math.sqrt(downside.reduce((s, r) => s + r * r, 0) / downside.length)
    : 0;
  const rfPerTrade = riskFreeRate / 100 / Math.max(rets.length, 1);
  const perYear = 252; // trade-based annualisation proxy
  const tradesPerYear = Math.min(perYear, Math.max(1, rets.length));
  const sharpe = sd > 0 ? ((meanRet - rfPerTrade) / sd) * Math.sqrt(tradesPerYear) : 0;
  const sortino = dsd > 0 ? ((meanRet - rfPerTrade) / dsd) * Math.sqrt(tradesPerYear) : 0;

  const spanDays = daysBetween(trades[0].date, trades[trades.length - 1].date);
  const years = Math.max(spanDays / 365, 1 / 365);
  const finalEquity = capital + netPnl;
  const cagr = finalEquity > 0 ? ((finalEquity / capital) ** (1 / years) - 1) * 100 : -100;

  let winStreak = 0, lossStreak = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.pnlNet > 0) { curWin++; curLoss = 0; } else if (t.pnlNet < 0) { curLoss++; curWin = 0; }
    if (curWin > winStreak) winStreak = curWin;
    if (curLoss > lossStreak) lossStreak = curLoss;
  }

  return {
    trades: trades.length,
    grossPnl,
    netPnl,
    costTotal: grossPnl - netPnl,
    maxDrawdown: maxDD,
    maxDrawdownDurationTrades: ddTrades,
    maxDrawdownDurationDays: ddDays,
    sharpe,
    sortino,
    calmar: maxDD > 0 ? cagr / ((maxDD / capital) * 100) : 0,
    recoveryFactor: maxDD > 0 ? netPnl / maxDD : 0,
    cagr,
    longestWinStreak: winStreak,
    longestLossStreak: lossStreak,
    years,
    finalEquity,
  };
}

/* ------------------------------------------------------------------ */
/* monte carlo                                                         */
/* ------------------------------------------------------------------ */

export interface MonteCarloResult {
  runs: number;
  netProfit: { p5: number; p50: number; p95: number };
  maxDrawdown: { p5: number; p50: number; p95: number };
  ruinProbability: number;
  histogram: { label: string; count: number }[];
  ddHistogram: { label: string; count: number }[];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pct = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))] : 0;

function histogram(values: number[], bins = 20): { label: string; count: number }[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[idx]++;
  }
  return counts.map((count, i) => ({
    label: `${Math.round(min + i * width)}`,
    count,
  }));
}

export function runMonteCarlo(pnls: number[], runs = 1000, initialCapital = 10000, seed = 42): MonteCarloResult {
  const empty = { p5: 0, p50: 0, p95: 0 };
  if (pnls.length === 0) {
    return { runs: 0, netProfit: empty, maxDrawdown: empty, ruinProbability: 0, histogram: [], ddHistogram: [] };
  }
  const rand = mulberry32(seed);
  const nets: number[] = [];
  const dds: number[] = [];
  let ruined = 0;

  for (let r = 0; r < runs; r++) {
    const shuffled = pnls.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let eq = 0, peak = 0, maxDD = 0;
    for (const p of shuffled) {
      eq += p;
      if (eq > peak) peak = eq;
      if (peak - eq > maxDD) maxDD = peak - eq;
    }
    if (maxDD >= initialCapital) ruined++;
    nets.push(eq);
    dds.push(maxDD);
  }

  const sortedNets = nets.slice().sort((a, b) => a - b);
  const sortedDds = dds.slice().sort((a, b) => a - b);
  return {
    runs,
    netProfit: { p5: pct(sortedNets, 5), p50: pct(sortedNets, 50), p95: pct(sortedNets, 95) },
    maxDrawdown: { p5: pct(sortedDds, 5), p50: pct(sortedDds, 50), p95: pct(sortedDds, 95) },
    ruinProbability: (ruined / runs) * 100,
    histogram: histogram(nets),
    ddHistogram: histogram(dds),
  };
}

/* ------------------------------------------------------------------ */
/* walk forward + out of sample                                        */
/* ------------------------------------------------------------------ */

export interface WindowStats {
  label: string;
  from: string;
  to: string;
  trades: number;
  netPnl: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
}

export function windowStats(label: string, trades: MetricTrade[]): WindowStats {
  const wins = trades.filter((t) => t.pnlNet > 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlNet, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnlNet < 0).reduce((s, t) => s + t.pnlNet, 0));
  let eq = 0, peak = 0, maxDD = 0;
  for (const t of trades) {
    eq += t.pnlNet;
    if (eq > peak) peak = eq;
    if (peak - eq > maxDD) maxDD = peak - eq;
  }
  return {
    label,
    from: trades[0]?.date ?? "-",
    to: trades[trades.length - 1]?.date ?? "-",
    trades: trades.length,
    netPnl: trades.reduce((s, t) => s + t.pnlNet, 0),
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    maxDrawdown: maxDD,
  };
}

export function splitInOutSample<T extends MetricTrade>(trades: T[], inSamplePct: number) {
  const cut = Math.round((trades.length * inSamplePct) / 100);
  return { inSample: trades.slice(0, cut), outSample: trades.slice(cut) };
}

export interface WalkForwardResult {
  folds: { label: string; inSample: WindowStats; outSample: WindowStats }[];
  /** concatenated out-of-sample trades, in chronological order */
  oosTrades: MetricTrade[];
  efficiency: number;
}

export function runWalkForward(trades: MetricTrade[], folds: number, inSamplePct: number): WalkForwardResult {
  if (trades.length < folds * 4) return { folds: [], oosTrades: [], efficiency: 0 };
  const windowSize = Math.floor(trades.length / folds);
  const isSize = Math.max(1, Math.round((windowSize * inSamplePct) / 100));
  const out: WalkForwardResult["folds"] = [];
  const oosTrades: MetricTrade[] = [];

  for (let f = 0; f < folds; f++) {
    const start = f * windowSize;
    const slice = trades.slice(start, f === folds - 1 ? trades.length : start + windowSize);
    if (slice.length < 2) continue;
    const is = slice.slice(0, isSize);
    const oos = slice.slice(isSize);
    if (!oos.length) continue;
    oosTrades.push(...oos);
    out.push({
      label: `fold ${f + 1}`,
      inSample: windowStats("in-sample", is),
      outSample: windowStats("out-of-sample", oos),
    });
  }

  const isAvg = out.length ? out.reduce((s, f) => s + f.inSample.netPnl / Math.max(f.inSample.trades, 1), 0) / out.length : 0;
  const oosAvg = out.length ? out.reduce((s, f) => s + f.outSample.netPnl / Math.max(f.outSample.trades, 1), 0) / out.length : 0;
  return { folds: out, oosTrades, efficiency: isAvg !== 0 ? (oosAvg / isAvg) * 100 : 0 };
}

/* ------------------------------------------------------------------ */
/* market regime                                                       */
/* ------------------------------------------------------------------ */

export type Regime = "trending up" | "trending down" | "sideways" | "high volatility";

export interface DailyBar { date: string; close: number; high: number; low: number }

/** classifies each trading day using only data available up to that day (no lookahead) */
export function classifyRegimes(daily: DailyBar[], lookback = 10): Map<string, Regime> {
  const map = new Map<string, Regime>();
  const ranges = daily.map((d) => (d.high - d.low) / (d.close || 1));
  for (let i = 0; i < daily.length; i++) {
    if (i < lookback) { map.set(daily[i].date, "sideways"); continue; }
    const past = daily.slice(i - lookback, i); // closed bars only
    const ret = (past[past.length - 1].close - past[0].close) / (past[0].close || 1);
    const avgRange = ranges.slice(Math.max(0, i - lookback), i).reduce((s, r) => s + r, 0) / lookback;
    const baseRange = ranges.slice(0, i).reduce((s, r) => s + r, 0) / Math.max(i, 1);
    let regime: Regime;
    if (avgRange > baseRange * 1.5) regime = "high volatility";
    else if (ret > 0.02) regime = "trending up";
    else if (ret < -0.02) regime = "trending down";
    else regime = "sideways";
    map.set(daily[i].date, regime);
  }
  return map;
}

/** builds daily bars (last close per date) from intraday bars */
export function toDailyBars(bars: any[]): DailyBar[] {
  const map = new Map<string, DailyBar>();
  const sorted = bars
    .map((b) => ({
      dt: String(b.datetime ?? "").replace("T", " "),
      close: Number(b.close),
      high: Number(b.high),
      low: Number(b.low),
    }))
    .filter((b) => b.dt && isFinite(b.close))
    .sort((a, b) => a.dt.localeCompare(b.dt));
  for (const b of sorted) {
    const date = b.dt.split(" ")[0];
    const cur = map.get(date);
    if (!cur) map.set(date, { date, close: b.close, high: b.high, low: b.low });
    else {
      cur.close = b.close;
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
