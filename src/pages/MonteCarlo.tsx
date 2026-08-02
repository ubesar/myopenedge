import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Play, Dices, ShieldAlert, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { analyzePullback50, type Pullback50Trade } from "@/lib/pullback50-analysis";
import { analyzeIB2575, type IB2575Trade } from "@/lib/ib2575-analysis";
import { analyzeIB, type AnalysisResult as IBAnalysisResult } from "@/lib/ib-analysis";

type StrategyKey = "pb50" | "ib2575" | "ibbreakout";

const RISK_USD = 100;
const MAX_BATCH_DAYS = 60;
const BATCH_OUTPUTSIZE = 5000;
const BATCH_DELAY_MS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchMarketData(ticker: string, totalDays: number) {
  if (totalDays <= MAX_BATCH_DAYS) {
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
      body: { symbol: ticker, outputsize: String(BATCH_OUTPUTSIZE), key_index: 0 },
    });
    if (error) throw new Error("failed to fetch market data");
    return data;
  }
  let allValues: any[] = [];
  let endDate: string | null = null;
  let remaining = totalDays;
  let batchIndex = 0;
  while (remaining > 0) {
    const body: Record<string, any> = {
      symbol: ticker,
      outputsize: String(BATCH_OUTPUTSIZE),
      key_index: batchIndex,
    };
    if (endDate) body.end_date = endDate;
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body });
    if (error) throw new Error("failed to fetch batch " + (batchIndex + 1));
    if (data?.status === "error") throw new Error(data.message || "api error");
    const values = data?.values;
    if (!values?.length) break;
    allValues = allValues.concat(values);
    endDate = values[values.length - 1].datetime;
    remaining -= MAX_BATCH_DAYS;
    batchIndex++;
    if (remaining > 0) await sleep(BATCH_DELAY_MS);
  }
  const seen = new Set<string>();
  return { values: allValues.filter((v) => (seen.has(v.datetime) ? false : (seen.add(v.datetime), true))) };
}

interface MCTrade {
  pnl: number;
  outcome: "win" | "loss";
}

function tradesFromPB50(trades: Pullback50Trade[]): MCTrade[] {
  const out: MCTrade[] = [];
  for (const t of trades) {
    if (t.outcome !== "win" && t.outcome !== "loss") continue;
    const slDist = Math.abs(t.entry - t.stop);
    const tpDist = Math.abs(t.target - t.entry);
    if (slDist <= 0) continue;
    const r = t.outcome === "win" ? tpDist / slDist : -1;
    out.push({ pnl: r * RISK_USD, outcome: t.outcome });
  }
  return out;
}

function tradesFromIB2575(trades: IB2575Trade[]): MCTrade[] {
  const out: MCTrade[] = [];
  for (const t of trades) {
    if (t.outcome !== "win" && t.outcome !== "loss") continue;
    const slDist = Math.abs(t.entry - t.stop);
    const tpDist = Math.abs(t.target - t.entry);
    if (slDist <= 0) continue;
    const r = t.outcome === "win" ? tpDist / slDist : -1;
    out.push({ pnl: r * RISK_USD, outcome: t.outcome });
  }
  return out;
}

/**
 * IB breakout via analyzeIB: use breakout-then-fail rates as win/loss basis.
 * Each valid day produces one synthetic trade with symmetric 1R.
 */
function tradesFromIB(r: IBAnalysisResult): MCTrade[] {
  const out: MCTrade[] = [];
  const total = r.totalDays;
  if (!total) return out;
  // Win = clean single breakout that holds; loss = double break (failed breakout) or no break.
  const wins = r.breakTypeStats.singleBreak;
  const losses = r.breakTypeStats.doubleBreak + r.breakTypeStats.noBreak;
  for (let i = 0; i < wins; i++) out.push({ pnl: RISK_USD, outcome: "win" });
  for (let i = 0; i < losses; i++) out.push({ pnl: -RISK_USD, outcome: "loss" });
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function equityStats(trades: MCTrade[]) {
  let eq = 0;
  let peak = 0;
  let maxDD = 0;
  let curLoss = 0;
  let maxLossStreak = 0;
  for (const t of trades) {
    eq += t.pnl;
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDD) maxDD = dd;
    if (t.outcome === "loss") {
      curLoss++;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    } else curLoss = 0;
  }
  return { finalPnl: eq, maxDD, maxLossStreak };
}

interface MCResult {
  iterations: number;
  totalTrades: number;
  base: { finalPnl: number; maxDD: number; maxLossStreak: number };
  finalPnls: number[];
  drawdowns: number[];
  lossStreaks: number[];
  sampleCurves: { i: number; equity: number }[][];
  ruinPct: number;
  ruinThreshold: number;
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function runMonteCarlo(baseTrades: MCTrade[], iterations: number, ruinThreshold: number): MCResult {
  const finalPnls: number[] = [];
  const drawdowns: number[] = [];
  const lossStreaks: number[] = [];
  const sampleCurves: { i: number; equity: number }[][] = [];
  let ruinCount = 0;

  for (let n = 0; n < iterations; n++) {
    const shuffled = shuffle(baseTrades);
    const stats = equityStats(shuffled);
    finalPnls.push(stats.finalPnl);
    drawdowns.push(stats.maxDD);
    lossStreaks.push(stats.maxLossStreak);
    if (stats.maxDD >= ruinThreshold) ruinCount++;
    if (sampleCurves.length < 25) {
      let eq = 0;
      sampleCurves.push(shuffled.map((t, i) => ({ i: i + 1, equity: (eq += t.pnl) })));
    }
  }

  return {
    iterations,
    totalTrades: baseTrades.length,
    base: equityStats(baseTrades),
    finalPnls,
    drawdowns,
    lossStreaks,
    sampleCurves,
    ruinPct: (ruinCount / iterations) * 100,
    ruinThreshold,
  };
}

const MonteCarlo = () => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [symbol, setSymbol] = useState("QQQ");
  const [strategy, setStrategy] = useState<StrategyKey>("pb50");
  const [maxDays, setMaxDays] = useState("240");
  const [ibWindow, setIbWindow] = useState("60");
  const [iterations, setIterations] = useState("2000");
  const [ruinThreshold, setRuinThreshold] = useState("500");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MCResult | null>(null);

  const run = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const days = parseInt(maxDays);
      const json = await fetchMarketData(symbol.trim().toUpperCase(), days);
      const values = json?.values;
      if (!values?.length) throw new Error("no data returned");

      let base: MCTrade[] = [];
      if (strategy === "pb50") {
        const r = analyzePullback50(values, days, [1, 2, 3, 4, 5]);
        base = tradesFromPB50(r.trades);
      } else if (strategy === "ib2575") {
        const r = analyzeIB2575(values, parseInt(ibWindow), days, [1, 2, 3, 4, 5]);
        base = tradesFromIB2575(r.trades);
      } else {
        const r = analyzeIB(values, parseInt(ibWindow), days, [1, 2, 3, 4, 5]);
        base = tradesFromIB(r);
      }

      if (base.length < 30) {
        toast.warning(`only ${base.length} trades — results may be noisy`);
      }
      if (base.length === 0) {
        toast.error("no trades to simulate");
        return;
      }

      const iters = Math.max(100, Math.min(10000, parseInt(iterations) || 2000));
      const ruin = Math.max(1, parseInt(ruinThreshold) || 500);
      const mc = runMonteCarlo(base, iters, ruin);
      setResult(mc);
      toast.success(`simulated ${iters.toLocaleString()} iterations`);
    } catch (e: any) {
      toast.error(e.message || "simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const sortedPnl = useMemo(() => (result ? [...result.finalPnls].sort((a, b) => a - b) : []), [result]);
  const sortedDD = useMemo(() => (result ? [...result.drawdowns].sort((a, b) => a - b) : []), [result]);
  const sortedStreak = useMemo(() => (result ? [...result.lossStreaks].sort((a, b) => a - b) : []), [result]);

  const pnlHistogram = useMemo(() => {
    if (!sortedPnl.length) return [];
    const min = sortedPnl[0];
    const max = sortedPnl[sortedPnl.length - 1];
    const bins = 20;
    const w = (max - min) / bins || 1;
    const buckets = new Array(bins).fill(0).map((_, i) => ({
      label: `$${Math.round(min + i * w)}`,
      count: 0,
    }));
    for (const v of sortedPnl) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / w)));
      buckets[idx].count++;
    }
    return buckets;
  }, [sortedPnl]);

  const ddHistogram = useMemo(() => {
    if (!sortedDD.length) return [];
    const max = sortedDD[sortedDD.length - 1];
    const bins = 20;
    const w = max / bins || 1;
    const buckets = new Array(bins).fill(0).map((_, i) => ({
      label: `-$${Math.round((i + 1) * w)}`,
      count: 0,
    }));
    for (const v of sortedDD) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(v / w)));
      buckets[idx].count++;
    }
    return buckets;
  }, [sortedDD]);

  const stats = useMemo(() => {
    if (!result || !sortedPnl.length) return null;
    return {
      medianPnl: percentile(sortedPnl, 50),
      p5Pnl: percentile(sortedPnl, 5),
      p95Pnl: percentile(sortedPnl, 95),
      profitProb: (sortedPnl.filter((v) => v > 0).length / sortedPnl.length) * 100,
      medianDD: percentile(sortedDD, 50),
      p95DD: percentile(sortedDD, 95),
      p99DD: percentile(sortedDD, 99),
      medianStreak: percentile(sortedStreak, 50),
      p95Streak: percentile(sortedStreak, 95),
    };
  }, [result, sortedPnl, sortedDD, sortedStreak]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppNavSidebar
        collapsed={isMobile ? !mobileOpen : collapsed}
        onToggle={() => (isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed))}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && <MobileHeader onMenuToggle={() => setMobileOpen(!mobileOpen)} title="monte carlo" />}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 max-w-[1400px] w-full mx-auto">
          <div>
            <h1 className="text-2xl font-bold lowercase flex items-center gap-2">
              <Dices className="h-6 w-6 text-primary" />
              monte carlo simulation
            </h1>
            <p className="text-sm text-muted-foreground lowercase">
              acak ulang urutan trade ribuan kali untuk mengukur robustness, risk of ruin, dan expected drawdown.
            </p>
          </div>

          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">strategy</Label>
                <Select value={strategy} onValueChange={(v) => setStrategy(v as StrategyKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pb50">50% pullback</SelectItem>
                    <SelectItem value="ib2575">ib momentum limit (ib25/75)</SelectItem>
                    <SelectItem value="ibbreakout">ib breakout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">ticker</Label>
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">trading days</Label>
                <Select value={maxDays} onValueChange={setMaxDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">3 months</SelectItem>
                    <SelectItem value="120">6 months</SelectItem>
                    <SelectItem value="240">12 months</SelectItem>
                    <SelectItem value="480">24 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(strategy === "ib2575" || strategy === "ibbreakout") && (
                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">ib window (min)</Label>
                  <Select value={ibWindow} onValueChange={setIbWindow}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="60">60</SelectItem>
                      <SelectItem value="90">90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">iterations</Label>
                <Select value={iterations} onValueChange={setIterations}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1,000</SelectItem>
                    <SelectItem value="2000">2,000</SelectItem>
                    <SelectItem value="5000">5,000</SelectItem>
                    <SelectItem value="10000">10,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">ruin threshold ($)</Label>
                <Input
                  value={ruinThreshold}
                  onChange={(e) => setRuinThreshold(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>
            </div>
            <Button onClick={run} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />simulating…</>
              ) : (
                <><Play className="mr-2 h-4 w-4" />run monte carlo</>
              )}
            </Button>
          </Card>

          {result && stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="iterations" value={result.iterations.toLocaleString()} />
                <StatCard label="base trades" value={String(result.totalTrades)} />
                <StatCard
                  label="prob profit"
                  value={`${stats.profitProb.toFixed(1)}%`}
                  accent={stats.profitProb >= 60 ? "pos" : "neg"}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <StatCard
                  label="risk of ruin"
                  value={`${result.ruinPct.toFixed(1)}%`}
                  accent={result.ruinPct <= 5 ? "pos" : "neg"}
                  icon={<ShieldAlert className="h-4 w-4" />}
                />
                <StatCard label="median pnl" value={`$${stats.medianPnl.toFixed(0)}`} accent={stats.medianPnl >= 0 ? "pos" : "neg"} />
                <StatCard label="95% ci pnl low" value={`$${stats.p5Pnl.toFixed(0)}`} accent={stats.p5Pnl >= 0 ? "pos" : "neg"} icon={<TrendingDown className="h-4 w-4" />} />
                <StatCard label="95% ci pnl high" value={`$${stats.p95Pnl.toFixed(0)}`} accent="pos" />
                <StatCard label="median dd" value={`-$${stats.medianDD.toFixed(0)}`} accent="neg" />
                <StatCard label="95% dd" value={`-$${stats.p95DD.toFixed(0)}`} accent="neg" />
                <StatCard label="99% dd" value={`-$${stats.p99DD.toFixed(0)}`} accent="neg" />
                <StatCard label="median loss streak" value={String(stats.medianStreak)} />
                <StatCard label="95% loss streak" value={String(stats.p95Streak)} accent="neg" />
              </div>

              <Card className="p-4">
                <h2 className="text-sm font-semibold mb-3 lowercase">sample equity paths (25 simulasi)</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        dataKey="i"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        domain={[1, result.totalTrades]}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v: any) => [`$${v}`, "equity"]}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      {result.sampleCurves.map((curve, idx) => (
                        <Line
                          key={idx}
                          type="monotone"
                          data={curve}
                          dataKey="equity"
                          stroke="hsl(var(--primary))"
                          strokeWidth={1}
                          strokeOpacity={0.25}
                          dot={false}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h2 className="text-sm font-semibold mb-3 lowercase">final pnl distribution</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pnlHistogram}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} angle={-35} textAnchor="end" height={60} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="text-sm font-semibold mb-3 lowercase">max drawdown distribution</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ddHistogram}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} angle={-35} textAnchor="end" height={60} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--destructive))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card className="p-4 space-y-2 text-xs text-muted-foreground">
                <p className="lowercase">
                  <span className="text-foreground font-semibold">interpretasi:</span> risk of ruin ={" "}
                  {result.ruinPct.toFixed(1)}% dari {result.iterations.toLocaleString()} simulasi mengalami drawdown ≥
                  ${result.ruinThreshold}. pada tingkat kepercayaan 95%, drawdown tidak akan melebihi $
                  {stats.p95DD.toFixed(0)}, dan pnl akhir berada di rentang ${stats.p5Pnl.toFixed(0)} s/d $
                  {stats.p95Pnl.toFixed(0)}.
                </p>
                <p className="lowercase">
                  metode: trade order randomization (resampling tanpa pengembalian) dari {result.totalTrades} trade
                  historis. fixed risk ${RISK_USD}/trade.
                </p>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: "pos" | "neg";
  icon?: React.ReactNode;
}) => (
  <Card className="p-3">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] text-muted-foreground lowercase">{label}</span>
      {icon && <span className="text-muted-foreground">{icon}</span>}
    </div>
    <div
      className={`text-lg font-bold ${
        accent === "pos" ? "text-emerald-500" : accent === "neg" ? "text-rose-500" : "text-foreground"
      }`}
    >
      {value}
    </div>
  </Card>
);

export default MonteCarlo;
