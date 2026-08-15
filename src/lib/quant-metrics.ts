/**
 * quant-metrics.ts — shared quant layer for every trade-producing report.
 *
 * Takes a generic list of trades and produces:
 *   1. EV after cost (commission + slippage)
 *   2. Sample size & Wilson 95% confidence interval
 *   3. Fractional Kelly sizing
 *   4. Edge decay (in-sample vs out-of-sample + rolling buckets)
 */

export type QuantOutcome = "win" | "loss" | "open";

export interface QuantTrade {
  date: string;                 // yyyy-MM-dd
  side: "long" | "short";
  entry: number;
  exit?: number;                // optional realised exit price
  risk: number;                 // price distance entry → stop (1R), in points
  outcome: QuantOutcome;
  rMultiple?: number;           // optional explicit gross R (overrides derivation)
}

export interface QuantSettings {
  /** commission per side, in $ per unit traded */
  commissionPerSide: number;
  /** slippage assumed per side, in ticks */
  slippageTicks: number;
  /** tick size in price points */
  tickSize: number;
  /** $ value of one tick */
  tickValue: number;
  /** account size in $ */
  accountSize: number;
  /** % of account risked per trade */
  riskPct: number;
}

export const DEFAULT_QUANT_SETTINGS: QuantSettings = {
  commissionPerSide: 0.005,
  slippageTicks: 1,
  tickSize: 0.01,
  tickValue: 0.01,
  accountSize: 25000,
  riskPct: 1,
};

export interface EdgeBucket {
  label: string;
  n: number;
  wins: number;
  winRate: number;
  netEvR: number;
}

export interface QuantMetrics {
  // sample
  n: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number;             // %
  ciLow: number;               // %
  ciHigh: number;              // %
  smallSample: boolean;
  edgeProven: boolean;

  // payoff / EV
  avgWinR: number;
  avgLossR: number;
  payoff: number;              // avgWinR / avgLossR
  grossEvR: number;
  costR: number;
  netEvR: number;
  breakevenWinRate: number;    // %
  profitFactorGross: number;
  profitFactorNet: number;

  // dollars
  riskDollar: number;          // $ risked per trade (accountSize * riskPct%)
  costDollar: number;          // round-turn cost in $ per trade at that size
  netEvDollar: number;         // per trade
  netEvDollarPerDay: number;
  totalNetDollar: number;
  tradingDays: number;

  // sizing
  kellyFull: number;           // fraction 0..1 (can be negative)
  kellyHalf: number;
  kellyQuarter: number;
  kellyRiskDollar: number;     // $ risk per trade at quarter kelly
  noEdge: boolean;

  // decay
  inSample: EdgeBucket;
  outSample: EdgeBucket;
  buckets: EdgeBucket[];
  decayStatus: "stable" | "decaying" | "restored" | "insufficient";

  // performance report (equity-curve based, à la investing-algorithm-framework)
  perf: PerfMetrics;
}

export interface PerfPoint {
  date: string;
  equity: number;
}

export interface PerfMetrics {
  startEquity: number;
  endEquity: number;
  netProfitDollar: number;
  netProfitPct: number;
  cagrPct: number;
  years: number;
  maxDrawdownPct: number;
  maxDrawdownDollar: number;
  maxDrawdownDurationDays: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  recoveryFactor: number;
  volatilityAnnualPct: number;
  bestTradeR: number;
  worstTradeR: number;
  avgTradeR: number;
  stdevTradeR: number;
  maxWinStreak: number;
  maxLossStreak: number;
  tradesPerDay: number;
  exposurePct: number;
  curve: PerfPoint[];
}




/** Wilson score interval for a binomial proportion (95%). */
export function wilsonInterval(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [
    Math.max(0, (centre - margin) / denom) * 100,
    Math.min(1, (centre + margin) / denom) * 100,
  ];
}

function grossR(t: QuantTrade): number | null {
  if (t.outcome === "open") return null;
  if (typeof t.rMultiple === "number") return t.rMultiple;
  if (typeof t.exit === "number" && t.risk > 0) {
    const diff = t.side === "long" ? t.exit - t.entry : t.entry - t.exit;
    return diff / t.risk;
  }
  return t.outcome === "win" ? 1 : -1;
}

function buildBucket(label: string, rows: { win: boolean; netR: number }[]): EdgeBucket {
  const n = rows.length;
  const wins = rows.filter((r) => r.win).length;
  const netEvR = n > 0 ? rows.reduce((a, r) => a + r.netR, 0) / n : 0;
  return { label, n, wins, winRate: n > 0 ? (wins / n) * 100 : 0, netEvR };
}

export function computeQuantMetrics(
  trades: QuantTrade[],
  settings: QuantSettings = DEFAULT_QUANT_SETTINGS,
): QuantMetrics {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const resolved = sorted.filter((t) => t.outcome !== "open");
  const openCount = sorted.length - resolved.length;

  const rs = resolved.map((t) => ({ trade: t, r: grossR(t) ?? 0 }));
  const winRows = rs.filter((x) => x.r > 0);
  const lossRows = rs.filter((x) => x.r <= 0);

  const n = rs.length;
  const wins = winRows.length;
  const losses = lossRows.length;
  const winRate = n > 0 ? (wins / n) * 100 : 0;
  const [ciLow, ciHigh] = wilsonInterval(wins, n);

  const avgWinR = wins > 0 ? winRows.reduce((a, x) => a + x.r, 0) / wins : 0;
  const avgLossR = losses > 0 ? Math.abs(lossRows.reduce((a, x) => a + x.r, 0) / losses) : 0;
  const payoff = avgLossR > 0 ? avgWinR / avgLossR : avgWinR > 0 ? Infinity : 0;

  const grossEvR = n > 0 ? rs.reduce((a, x) => a + x.r, 0) / n : 0;

  // cost model
  const pointValue = settings.tickSize > 0 ? settings.tickValue / settings.tickSize : 1;
  const riskDollar = (settings.accountSize * settings.riskPct) / 100;
  const avgRiskPoints = n > 0
    ? rs.reduce((a, x) => a + (x.trade.risk > 0 ? x.trade.risk : 0), 0) / n
    : 0;
  // units sized so that avgRiskPoints * units * pointValue = riskDollar
  const units = avgRiskPoints > 0 && pointValue > 0 ? riskDollar / (avgRiskPoints * pointValue) : 0;
  const slippageDollar = 2 * settings.slippageTicks * settings.tickValue * units;
  const commissionDollar = 2 * settings.commissionPerSide * units;
  const costDollar = slippageDollar + commissionDollar;
  const costR = riskDollar > 0 ? costDollar / riskDollar : 0;

  const netEvR = grossEvR - costR;
  const netEvDollar = netEvR * riskDollar;
  const totalNetDollar = netEvDollar * n;

  const grossWinSum = winRows.reduce((a, x) => a + x.r, 0);
  const grossLossSum = Math.abs(lossRows.reduce((a, x) => a + x.r, 0));
  const profitFactorGross = grossLossSum > 0 ? grossWinSum / grossLossSum : grossWinSum > 0 ? Infinity : 0;
  const netWinSum = winRows.reduce((a, x) => a + Math.max(0, x.r - costR), 0);
  const netLossSum = lossRows.reduce((a, x) => a + Math.abs(x.r - costR), 0)
    + winRows.reduce((a, x) => a + Math.max(0, costR - x.r), 0);
  const profitFactorNet = netLossSum > 0 ? netWinSum / netLossSum : netWinSum > 0 ? Infinity : 0;

  const breakevenWinRate = payoff > 0 && Number.isFinite(payoff)
    ? ((avgLossR + costR) / (avgWinR + avgLossR)) * 100
    : 0;

  // Kelly on R terms
  const W = n > 0 ? wins / n : 0;
  const netPayoff = avgLossR > 0 ? (avgWinR - costR) / (avgLossR + costR) : 0;
  const kellyFull = netPayoff > 0 ? W - (1 - W) / netPayoff : -1;
  const kellyHalf = kellyFull / 2;
  const kellyQuarter = kellyFull / 4;

  const tradingDays = new Set(sorted.map((t) => t.date)).size;
  const netEvDollarPerDay = tradingDays > 0 ? totalNetDollar / tradingDays : 0;

  // decay
  const rows = rs.map((x) => ({ date: x.trade.date, win: x.r > 0, netR: x.r - costR }));
  const splitIdx = Math.floor(rows.length * 0.6);
  const inSample = buildBucket("in-sample (60%)", rows.slice(0, splitIdx));
  const outSample = buildBucket("out-of-sample (40%)", rows.slice(splitIdx));

  // rolling buckets: by month if ≥ 3 distinct months, otherwise chunks of 20 trades
  const months = Array.from(new Set(rows.map((r) => r.date.slice(0, 7)))).sort();
  let buckets: EdgeBucket[] = [];
  if (months.length >= 3) {
    buckets = months.map((m) => buildBucket(m, rows.filter((r) => r.date.startsWith(m))));
  } else {
    for (let i = 0; i < rows.length; i += 20) {
      buckets.push(buildBucket(`#${i + 1}–${Math.min(i + 20, rows.length)}`, rows.slice(i, i + 20)));
    }
  }

  let decayStatus: QuantMetrics["decayStatus"] = "insufficient";
  if (inSample.n >= 10 && outSample.n >= 10) {
    const delta = outSample.netEvR - inSample.netEvR;
    if (delta < -0.15) decayStatus = "decaying";
    else if (delta > 0.15) decayStatus = "restored";
    else decayStatus = "stable";
  }

  // ---------- performance report (equity curve) ----------
  const startEquity = settings.accountSize > 0 ? settings.accountSize : 100000;
  const perTrade = rows.map((r) => ({ date: r.date, pnl: r.netR * riskDollar, win: r.win }));

  const curve: PerfPoint[] = [];
  let equity = startEquity;
  let peak = startEquity;
  let maxDdPct = 0;
  let maxDdDollar = 0;
  let ddStart: string | null = null;
  let maxDdDays = 0;

  const dayPnl = new Map<string, number>();
  for (const t of perTrade) dayPnl.set(t.date, (dayPnl.get(t.date) ?? 0) + t.pnl);
  const days = Array.from(dayPnl.keys()).sort();

  const dailyReturns: number[] = [];
  for (const d of days) {
    const prev = equity;
    equity += dayPnl.get(d)!;
    dailyReturns.push(prev > 0 ? (equity - prev) / prev : 0);
    curve.push({ date: d, equity });
    if (equity >= peak) {
      peak = equity;
      ddStart = null;
    } else {
      if (!ddStart) ddStart = d;
      const ddD = peak - equity;
      const ddP = peak > 0 ? (ddD / peak) * 100 : 0;
      if (ddP > maxDdPct) { maxDdPct = ddP; maxDdDollar = ddD; }
      const durDays = Math.round(
        (new Date(d + "T00:00:00").getTime() - new Date(ddStart + "T00:00:00").getTime()) / 86400000,
      );
      if (durDays > maxDdDays) maxDdDays = durDays;
    }
  }

  const endEquity = equity;
  const netProfitDollar = endEquity - startEquity;
  const netProfitPct = startEquity > 0 ? (netProfitDollar / startEquity) * 100 : 0;

  const spanDays = days.length > 1
    ? Math.max(1, (new Date(days[days.length - 1] + "T00:00:00").getTime() - new Date(days[0] + "T00:00:00").getTime()) / 86400000)
    : Math.max(1, days.length);
  const years = spanDays / 365;
  const cagrPct = years > 0 && startEquity > 0 && endEquity > 0
    ? (Math.pow(endEquity / startEquity, 1 / years) - 1) * 100
    : 0;

  const mean = dailyReturns.length ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (dailyReturns.length - 1)
    : 0;
  const sd = Math.sqrt(variance);
  const downside = dailyReturns.filter((r) => r < 0);
  const dsd = downside.length
    ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length)
    : 0;
  const ann = Math.sqrt(252);
  const sharpe = sd > 0 ? (mean / sd) * ann : 0;
  const sortino = dsd > 0 ? (mean / dsd) * ann : 0;
  const volatilityAnnualPct = sd * ann * 100;
  const calmar = maxDdPct > 0 ? cagrPct / maxDdPct : 0;
  const recoveryFactor = maxDdDollar > 0 ? netProfitDollar / maxDdDollar : 0;

  const rvals = rs.map((x) => x.r);
  const avgTradeR = rvals.length ? rvals.reduce((a, b) => a + b, 0) / rvals.length : 0;
  const stdevTradeR = rvals.length > 1
    ? Math.sqrt(rvals.reduce((a, b) => a + (b - avgTradeR) ** 2, 0) / (rvals.length - 1))
    : 0;

  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
  for (const t of perTrade) {
    if (t.win) { curW++; curL = 0; } else { curL++; curW = 0; }
    maxWinStreak = Math.max(maxWinStreak, curW);
    maxLossStreak = Math.max(maxLossStreak, curL);
  }

  const perf: PerfMetrics = {
    startEquity,
    endEquity,
    netProfitDollar,
    netProfitPct,
    cagrPct,
    years,
    maxDrawdownPct: maxDdPct,
    maxDrawdownDollar: maxDdDollar,
    maxDrawdownDurationDays: maxDdDays,
    sharpe,
    sortino,
    calmar,
    recoveryFactor,
    volatilityAnnualPct,
    bestTradeR: rvals.length ? Math.max(...rvals) : 0,
    worstTradeR: rvals.length ? Math.min(...rvals) : 0,
    avgTradeR,
    stdevTradeR,
    maxWinStreak,
    maxLossStreak,
    tradesPerDay: days.length ? perTrade.length / days.length : 0,
    exposurePct: tradingDays > 0 && spanDays > 0 ? Math.min(100, (days.length / Math.max(1, spanDays)) * 100) : 0,
    curve,
  };

  return {
    perf,

    n, wins, losses, open: openCount, winRate, ciLow, ciHigh,
    smallSample: n < 30,
    edgeProven: n > 0 && ciLow > breakevenWinRate,
    avgWinR, avgLossR, payoff, grossEvR, costR, netEvR, breakevenWinRate,
    profitFactorGross, profitFactorNet,
    riskDollar, costDollar, netEvDollar, netEvDollarPerDay, totalNetDollar, tradingDays,
    kellyFull, kellyHalf, kellyQuarter,
    kellyRiskDollar: Math.max(0, kellyQuarter) * settings.accountSize,
    noEdge: kellyFull <= 0,
    inSample, outSample, buckets, decayStatus,
  };
}
