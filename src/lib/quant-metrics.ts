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

  return {
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
