/**
 * Portfolio-style backtest metrics (MyOpenEdge).
 *
 * Metric definitions follow the investing-algorithm-framework reference:
 * https://coding-kitties.github.io/investing-algorithm-framework/Getting%20Started/metrics/
 *
 * All ratios are computed from a daily equity series built out of the trade log,
 * using a fixed starting capital so that percentage based metrics stay comparable
 * across strategies and symbols.
 */

export interface MetricTrade {
  /** "YYYY-MM-DD" */
  date: string;
  pnl: number;
  rMultiple?: number;
}

export interface AdvancedMetrics {
  initialCapital: number;
  finalCapital: number;
  /** total return in % over the whole period */
  totalReturnPct: number;
  /** compound annual growth rate in % */
  cagrPct: number;
  /** annualised standard deviation of daily returns in % */
  annualVolatilityPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  /** max peak-to-trough equity decline in % */
  maxDrawdownPct: number;
  /** absolute max drawdown in account currency */
  maxDrawdownAbs: number;
  /** longest number of calendar days spent below a previous equity peak */
  maxDrawdownDurationDays: number;
  /** net profit / max drawdown */
  recoveryFactor: number;
  /** % of trading days with at least one trade */
  exposurePct: number;
  tradingDays: number;
  daysInMarket: number;
  periodDays: number;
  tradesPerYear: number;
  winStreak: number;
  lossStreak: number;
  avgWinPct: number;
  avgLossPct: number;
  bestTradePct: number;
  worstTradePct: number;
  /** average R multiple (only when the trade log carries R) */
  avgRMultiple: number | null;
  /** % of daily returns above zero */
  positiveDaysPct: number;
  bestMonth: { month: string; pnl: number } | null;
  worstMonth: { month: string; pnl: number } | null;
  monthly: { month: string; pnl: number; returnPct: number }[];
  /** daily equity points for charting */
  equity: { date: string; equity: number; drawdownPct: number }[];
}

const DAYS_PER_YEAR = 252;

const daysBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));

export function computeAdvancedMetrics(
  trades: MetricTrade[],
  initialCapital = 10_000,
  riskFreeRate = 0
): AdvancedMetrics | null {
  if (!trades.length) return null;

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  // ---- daily aggregation -------------------------------------------------
  const byDay = new Map<string, number>();
  for (const t of sorted) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.pnl);
  const days = Array.from(byDay.keys()).sort();

  const equity: { date: string; equity: number; drawdownPct: number }[] = [];
  const dailyReturns: number[] = [];
  let cap = initialCapital;
  let peak = initialCapital;
  let maxDdPct = 0;
  let maxDdAbs = 0;
  let peakDate = days[0];
  let maxDdDuration = 0;

  for (const d of days) {
    const pnl = byDay.get(d)!;
    const prev = cap;
    cap += pnl;
    dailyReturns.push(prev !== 0 ? pnl / prev : 0);
    if (cap > peak) {
      peak = cap;
      peakDate = d;
    } else {
      maxDdDuration = Math.max(maxDdDuration, daysBetween(peakDate, d));
    }
    const ddAbs = peak - cap;
    const ddPct = peak > 0 ? (ddAbs / peak) * 100 : 0;
    if (ddAbs > maxDdAbs) maxDdAbs = ddAbs;
    if (ddPct > maxDdPct) maxDdPct = ddPct;
    equity.push({ date: d, equity: Math.round(cap * 100) / 100, drawdownPct: -Math.round(ddPct * 100) / 100 });
  }

  const periodDays = daysBetween(days[0], days[days.length - 1]);
  const years = Math.max(periodDays / 365, 1 / 365);

  const totalReturnPct = ((cap - initialCapital) / initialCapital) * 100;
  const growth = cap / initialCapital;
  const cagrPct = growth > 0 ? (Math.pow(growth, 1 / years) - 1) * 100 : -100;

  // ---- risk adjusted ratios ---------------------------------------------
  const n = dailyReturns.length;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / n;
  const variance = n > 1 ? dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const annualVolatilityPct = sd * Math.sqrt(DAYS_PER_YEAR) * 100;

  const rfDaily = riskFreeRate / DAYS_PER_YEAR;
  const sharpeRatio = sd > 0 ? ((mean - rfDaily) / sd) * Math.sqrt(DAYS_PER_YEAR) : 0;

  const downside = dailyReturns.filter((r) => r < rfDaily);
  const downsideSd = downside.length
    ? Math.sqrt(downside.reduce((s, r) => s + (r - rfDaily) ** 2, 0) / downside.length)
    : 0;
  const sortinoRatio = downsideSd > 0 ? ((mean - rfDaily) / downsideSd) * Math.sqrt(DAYS_PER_YEAR) : 0;

  const calmarRatio = maxDdPct > 0 ? cagrPct / maxDdPct : 0;
  const netProfit = cap - initialCapital;
  const recoveryFactor = maxDdAbs > 0 ? netProfit / maxDdAbs : 0;

  // ---- trade level -------------------------------------------------------
  let winStreak = 0, lossStreak = 0, curWin = 0, curLoss = 0;
  for (const t of sorted) {
    if (t.pnl > 0) { curWin++; curLoss = 0; } else if (t.pnl < 0) { curLoss++; curWin = 0; }
    winStreak = Math.max(winStreak, curWin);
    lossStreak = Math.max(lossStreak, curLoss);
  }

  const pctOf = (pnl: number) => (pnl / initialCapital) * 100;
  const winPcts = sorted.filter((t) => t.pnl > 0).map((t) => pctOf(t.pnl));
  const lossPcts = sorted.filter((t) => t.pnl < 0).map((t) => pctOf(t.pnl));
  const allPcts = sorted.map((t) => pctOf(t.pnl));

  const rs = sorted.filter((t) => typeof t.rMultiple === "number").map((t) => t.rMultiple as number);

  // ---- monthly breakdown -------------------------------------------------
  const monthMap = new Map<string, number>();
  for (const t of sorted) {
    const m = t.date.slice(0, 7);
    monthMap.set(m, (monthMap.get(m) ?? 0) + t.pnl);
  }
  const monthly = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, pnl]) => ({ month, pnl, returnPct: pctOf(pnl) }));
  const sortedMonths = [...monthly].sort((a, b) => b.pnl - a.pnl);

  const tradingDays = Math.max(1, Math.round((periodDays / 7) * 5));

  return {
    initialCapital,
    finalCapital: cap,
    totalReturnPct,
    cagrPct,
    annualVolatilityPct,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdownPct: maxDdPct,
    maxDrawdownAbs: maxDdAbs,
    maxDrawdownDurationDays: maxDdDuration,
    recoveryFactor,
    exposurePct: Math.min(100, (days.length / tradingDays) * 100),
    tradingDays,
    daysInMarket: days.length,
    periodDays,
    tradesPerYear: sorted.length / years,
    winStreak,
    lossStreak,
    avgWinPct: winPcts.length ? winPcts.reduce((s, v) => s + v, 0) / winPcts.length : 0,
    avgLossPct: lossPcts.length ? lossPcts.reduce((s, v) => s + v, 0) / lossPcts.length : 0,
    bestTradePct: allPcts.length ? Math.max(...allPcts) : 0,
    worstTradePct: allPcts.length ? Math.min(...allPcts) : 0,
    avgRMultiple: rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : null,
    positiveDaysPct: n ? (dailyReturns.filter((r) => r > 0).length / n) * 100 : 0,
    bestMonth: sortedMonths.length ? { month: sortedMonths[0].month, pnl: sortedMonths[0].pnl } : null,
    worstMonth: sortedMonths.length ? { month: sortedMonths[sortedMonths.length - 1].month, pnl: sortedMonths[sortedMonths.length - 1].pnl } : null,
    monthly,
    equity,
  };
}
