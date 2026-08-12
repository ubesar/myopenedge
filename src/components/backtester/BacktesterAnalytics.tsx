import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { AlertTriangle, Download, Info, Loader2 } from "lucide-react";
import {
  computeAdvancedMetrics, runMonteCarlo, runWalkForward, splitInOutSample, windowStats,
  classifyRegimes, toDailyBars, type MetricTrade, type Regime,
} from "@/lib/backtest-metrics";
import { hasCosts, type CostSettings } from "@/lib/backtest-costs";

export interface AnalyticsTrade extends MetricTrade {
  time?: string;
  exitTime?: string;
  direction: "bullish" | "bearish";
  entry: number;
  stop: number;
  target: number;
  qty: number;
  outcome: "win" | "loss";
  reason?: string;
  entryFilled: number;
  exitFilled: number;
  resolvedExit: number;
  costTotal: number;
}

export interface SensitivityRow {
  param: string;
  shift: string;
  trades: number;
  winRate: number;
  netPnl: number;
  maxDrawdown: number;
}

interface Props {
  trades: AnalyticsTrade[];
  bars: any[];
  symbol: string;
  costs: CostSettings;
  initialCapital: number;
  /** strategies that rely on repainting indicators (pivot / swing / zigzag) */
  repaintWarning?: string | null;
  sensitivity?: SensitivityRow[] | null;
  sensitivityLabel?: string;
  onRunSensitivity?: () => void;
  sensitivityLoading?: boolean;
}

const fmtUsd = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(0)}`;

const METRIC_HELP: Record<string, string> = {
  "sharpe ratio": "(rata-rata return − risk free) / standar deviasi return, disetahunkan. > 1 dianggap baik.",
  "sortino ratio": "seperti sharpe tapi hanya memakai downside deviation (volatilitas rugi saja).",
  "calmar ratio": "cagr / max drawdown (%) — imbal hasil tahunan per unit drawdown terdalam.",
  "recovery factor": "net profit / max drawdown — seberapa cepat strategi menutup drawdown.",
  "cagr": "compound annual growth rate dari equity curve terhadap modal awal.",
  "max dd duration": "durasi terlama equity berada di bawah puncak sebelumnya (hari kalender & jumlah trade).",
  "win streak": "jumlah trade profit beruntun terpanjang.",
  "loss streak": "jumlah trade rugi beruntun terpanjang.",
  "gross pnl": "pnl sebelum slippage & komisi.",
  "net pnl": "pnl setelah slippage & komisi dikurangkan.",
  "total cost": "total slippage + komisi yang dibebankan ke seluruh trade.",
};

const MetricCard = ({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) => (
  <Card className="p-3">
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground lowercase mb-1">
      {label}
      {METRIC_HELP[label] && (
        <TooltipProvider delayDuration={100}>
          <UITooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help"><Info className="h-3 w-3" /></span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-[11px] lowercase">{METRIC_HELP[label]}</TooltipContent>
          </UITooltip>
        </TooltipProvider>
      )}
    </div>
    <div className={`text-lg font-bold ${accent === "pos" ? "text-emerald-500" : accent === "neg" ? "text-red-500" : ""}`}>
      {value}
    </div>
  </Card>
);

const StatRow = ({ s }: { s: ReturnType<typeof windowStats> }) => (
  <tr className="border-b border-border/40">
    <td className="py-1.5 px-2 lowercase">{s.label}</td>
    <td className="py-1.5 px-2">{s.from} → {s.to}</td>
    <td className="py-1.5 px-2 text-right">{s.trades}</td>
    <td className="py-1.5 px-2 text-right">{s.winRate.toFixed(1)}%</td>
    <td className="py-1.5 px-2 text-right">{isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞"}</td>
    <td className="py-1.5 px-2 text-right text-red-500">-${s.maxDrawdown.toFixed(0)}</td>
    <td className={`py-1.5 px-2 text-right font-medium ${s.netPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
      {fmtUsd(s.netPnl)}
    </td>
  </tr>
);

const BacktesterAnalytics = ({
  trades, bars, symbol, costs, initialCapital,
  repaintWarning, sensitivity, sensitivityLabel, onRunSensitivity, sensitivityLoading,
}: Props) => {
  const [pctMode, setPctMode] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [inSamplePct, setInSamplePct] = useState(70);
  const [wfFolds, setWfFolds] = useState("4");
  const [mcRuns, setMcRuns] = useState("1000");

  const metrics = useMemo(
    () => computeAdvancedMetrics(trades, initialCapital),
    [trades, initialCapital],
  );

  const daily = useMemo(() => toDailyBars(bars), [bars]);

  /* equity curve + buy & hold benchmark */
  const equity = useMemo(() => {
    const closeByDate = new Map(daily.map((d) => [d.date, d.close]));
    const firstClose = daily[0]?.close ?? 0;
    let eq = initialCapital;
    return trades.map((t, i) => {
      eq += t.pnlNet;
      const close = closeByDate.get(t.date) ?? firstClose;
      const bhPct = firstClose > 0 ? ((close - firstClose) / firstClose) * 100 : 0;
      return {
        i: i + 1,
        date: t.date,
        strategy: pctMode
          ? Math.round(((eq - initialCapital) / initialCapital) * 10000) / 100
          : Math.round((eq - initialCapital) * 100) / 100,
        benchmark: pctMode
          ? Math.round(bhPct * 100) / 100
          : Math.round(initialCapital * (bhPct / 100) * 100) / 100,
      };
    });
  }, [trades, daily, pctMode, initialCapital]);

  /* out-of-sample split */
  const oos = useMemo(() => {
    const { inSample, outSample } = splitInOutSample(trades, inSamplePct);
    return { is: windowStats("in-sample", inSample), os: windowStats("out-of-sample", outSample) };
  }, [trades, inSamplePct]);

  const walkForward = useMemo(
    () => runWalkForward(trades, parseInt(wfFolds) || 4, inSamplePct),
    [trades, wfFolds, inSamplePct],
  );

  const wfCurve = useMemo(() => {
    let eq = 0;
    return walkForward.oosTrades.map((t, i) => {
      eq += t.pnlNet;
      return { i: i + 1, equity: Math.round(eq * 100) / 100 };
    });
  }, [walkForward]);

  const mc = useMemo(
    () => runMonteCarlo(trades.map((t) => t.pnlNet), parseInt(mcRuns) || 1000, initialCapital),
    [trades, mcRuns, initialCapital],
  );

  /* regime breakdown */
  const regimeRows = useMemo(() => {
    const regimes = classifyRegimes(daily);
    const agg = new Map<Regime, { trades: number; wins: number; net: number }>();
    for (const t of trades) {
      const r = regimes.get(t.date) ?? "sideways";
      const cur = agg.get(r) ?? { trades: 0, wins: 0, net: 0 };
      cur.trades++;
      if (t.pnlNet > 0) cur.wins++;
      cur.net += t.pnlNet;
      agg.set(r, cur);
    }
    return Array.from(agg.entries()).map(([regime, v]) => ({
      regime,
      trades: v.trades,
      winRate: v.trades ? (v.wins / v.trades) * 100 : 0,
      net: v.net,
    }));
  }, [trades, daily]);

  /* top 5 worst trades */
  const worstKeys = useMemo(() => {
    return new Set(
      [...trades]
        .map((t, i) => ({ i, pnl: t.pnlNet }))
        .sort((a, b) => a.pnl - b.pnl)
        .slice(0, 5)
        .filter((x) => x.pnl < 0)
        .map((x) => x.i),
    );
  }, [trades]);

  const exportCsv = () => {
    const header = [
      "seq", "entry_date", "entry_time", "exit_time", "direction", "entry_signal", "entry_filled",
      "exit_price", "exit_filled", "stop", "target", "qty", "duration", "pnl_gross", "cost", "pnl_net", "outcome", "reason",
    ];
    const rows = trades.map((t, i) => [
      i + 1, t.date, t.time ?? "", t.exitTime ?? "", t.direction === "bullish" ? "long" : "short",
      t.entry.toFixed(4), t.entryFilled.toFixed(4), t.resolvedExit.toFixed(4), t.exitFilled.toFixed(4),
      t.stop.toFixed(4), t.target.toFixed(4), t.qty.toFixed(4),
      t.time && t.exitTime ? `${t.time}→${t.exitTime}` : "",
      t.pnlGross.toFixed(2), t.costTotal.toFixed(2), t.pnlNet.toFixed(2), t.outcome, t.reason ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${symbol.toLowerCase()}-trade-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!trades.length) return null;

  return (
    <div className="space-y-4">
      {/* cost / integrity banner */}
      <div className="flex flex-wrap items-center gap-2">
        {hasCosts(costs) ? (
          <Badge variant="secondary" className="lowercase">
            net result · slippage {costs.slippage}{costs.slippageUnit === "tick" ? " tick" : " bps"} · fee ${costs.commissionPerTrade.toFixed(2)}/trade + ${costs.commissionPerShare.toFixed(3)}/share
          </Badge>
        ) : (
          <Badge variant="destructive" className="lowercase gap-1">
            <AlertTriangle className="h-3 w-3" /> gross result — belum dikurangi slippage / komisi
          </Badge>
        )}
        <Badge variant="outline" className="lowercase">snapshot data statis · sinyal dari bar closed</Badge>
        {repaintWarning && (
          <Badge variant="destructive" className="lowercase gap-1">
            <AlertTriangle className="h-3 w-3" /> {repaintWarning}
          </Badge>
        )}
      </div>

      {/* gross vs net + risk adjusted */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard label="gross pnl" value={fmtUsd(metrics.grossPnl)} accent={metrics.grossPnl >= 0 ? "pos" : "neg"} />
        <MetricCard label="net pnl" value={fmtUsd(metrics.netPnl)} accent={metrics.netPnl >= 0 ? "pos" : "neg"} />
        <MetricCard label="total cost" value={fmtUsd(-metrics.costTotal)} accent="neg" />
        <MetricCard label="sharpe ratio" value={metrics.sharpe.toFixed(2)} accent={metrics.sharpe >= 1 ? "pos" : "neg"} />
        <MetricCard label="sortino ratio" value={metrics.sortino.toFixed(2)} accent={metrics.sortino >= 1 ? "pos" : "neg"} />
        <MetricCard label="calmar ratio" value={metrics.calmar.toFixed(2)} accent={metrics.calmar >= 1 ? "pos" : "neg"} />
        <MetricCard label="recovery factor" value={metrics.recoveryFactor.toFixed(2)} accent={metrics.recoveryFactor >= 1 ? "pos" : "neg"} />
        <MetricCard label="cagr" value={`${metrics.cagr.toFixed(1)}%`} accent={metrics.cagr >= 0 ? "pos" : "neg"} />
        <MetricCard label="max dd duration" value={`${metrics.maxDrawdownDurationDays}d / ${metrics.maxDrawdownDurationTrades}t`} />
        <MetricCard label="win streak" value={String(metrics.longestWinStreak)} accent="pos" />
        <MetricCard label="loss streak" value={String(metrics.longestLossStreak)} accent="neg" />
        <MetricCard label="final equity" value={fmtUsd(metrics.finalEquity)} accent={metrics.finalEquity >= initialCapital ? "pos" : "neg"} />
      </div>

      {/* equity + benchmark */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold lowercase">equity curve vs buy &amp; hold {symbol.toLowerCase()}</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="pctmode" checked={pctMode} onCheckedChange={setPctMode} />
              <Label htmlFor="pctmode" className="text-xs lowercase">tampilkan % return</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="bench" checked={showBenchmark} onCheckedChange={setShowBenchmark} />
              <Label htmlFor="bench" className="text-xs lowercase">buy &amp; hold</Label>
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="i" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v: any, n: any) => [pctMode ? `${v}%` : `$${v}`, n]}
                labelFormatter={(l) => `trade #${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="strategy" name="strategy (net)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              {showBenchmark && (
                <Line type="monotone" dataKey="benchmark" name={`buy & hold ${symbol.toLowerCase()}`} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* robustness: oos + walk forward */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold lowercase">robustness · in-sample vs out-of-sample</h2>
            <p className="text-[11px] text-muted-foreground lowercase">split kronologis — parameter dituning di in-sample, divalidasi di out-of-sample</p>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs lowercase whitespace-nowrap">in-sample {inSamplePct}%</Label>
            <Slider className="w-40" min={30} max={90} step={5} value={[inSamplePct]} onValueChange={(v) => setInSamplePct(v[0])} />
            <Select value={wfFolds} onValueChange={setWfFolds}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["3", "4", "5", "6", "8"].map((f) => <SelectItem key={f} value={f}>{f} folds</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2 lowercase">window</th>
                <th className="text-left py-2 px-2 lowercase">periode</th>
                <th className="text-right py-2 px-2 lowercase">trades</th>
                <th className="text-right py-2 px-2 lowercase">win rate</th>
                <th className="text-right py-2 px-2 lowercase">pf</th>
                <th className="text-right py-2 px-2 lowercase">max dd</th>
                <th className="text-right py-2 px-2 lowercase">net pnl</th>
              </tr>
            </thead>
            <tbody>
              <StatRow s={oos.is} />
              <StatRow s={oos.os} />
              {walkForward.folds.map((f) => (
                <>
                  <StatRow key={`${f.label}-is`} s={{ ...f.inSample, label: `${f.label} · in` }} />
                  <StatRow key={`${f.label}-os`} s={{ ...f.outSample, label: `${f.label} · out` }} />
                </>
              ))}
            </tbody>
          </table>
        </div>

        {wfCurve.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground lowercase mb-2">
              walk-forward equity (gabungan out-of-sample) · efficiency {walkForward.efficiency.toFixed(0)}%
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wfCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="i" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: any) => [`$${v}`, "oos equity"]} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* monte carlo */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold lowercase">monte carlo · acak urutan trade</h2>
            <p className="text-[11px] text-muted-foreground lowercase">distribusi net profit &amp; max drawdown dari {mc.runs} simulasi</p>
          </div>
          <Select value={mcRuns} onValueChange={setMcRuns}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["250", "500", "1000", "2000"].map((r) => <SelectItem key={r} value={r}>{r} runs</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="net p5" value={fmtUsd(mc.netProfit.p5)} accent={mc.netProfit.p5 >= 0 ? "pos" : "neg"} />
          <MetricCard label="net p50" value={fmtUsd(mc.netProfit.p50)} accent={mc.netProfit.p50 >= 0 ? "pos" : "neg"} />
          <MetricCard label="net p95" value={fmtUsd(mc.netProfit.p95)} accent="pos" />
          <MetricCard label="dd p50" value={fmtUsd(-mc.maxDrawdown.p50)} accent="neg" />
          <MetricCard label="dd p95" value={fmtUsd(-mc.maxDrawdown.p95)} accent="neg" />
          <MetricCard label="risk of ruin" value={`${mc.ruinProbability.toFixed(1)}%`} accent={mc.ruinProbability > 1 ? "neg" : "pos"} />
          <MetricCard label="modal awal" value={fmtUsd(initialCapital)} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-56">
            <p className="text-[11px] text-muted-foreground lowercase mb-1">distribusi net profit ($)</p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={mc.histogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-56">
            <p className="text-[11px] text-muted-foreground lowercase mb-1">distribusi max drawdown ($)</p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={mc.ddHistogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* parameter sensitivity */}
      {onRunSensitivity && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold lowercase">parameter sensitivity</h2>
              <p className="text-[11px] text-muted-foreground lowercase">
                {sensitivityLabel ?? "parameter utama"} digeser ±10% dan ±20%
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={onRunSensitivity} disabled={sensitivityLoading}>
              {sensitivityLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "run sensitivity"}
            </Button>
          </div>
          {sensitivity?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2 lowercase">shift</th>
                    <th className="text-left py-2 px-2 lowercase">nilai</th>
                    <th className="text-right py-2 px-2 lowercase">trades</th>
                    <th className="text-right py-2 px-2 lowercase">win rate</th>
                    <th className="text-right py-2 px-2 lowercase">max dd</th>
                    <th className="text-right py-2 px-2 lowercase">net pnl</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.map((r) => (
                    <tr key={r.shift} className="border-b border-border/40">
                      <td className="py-1.5 px-2">{r.shift}</td>
                      <td className="py-1.5 px-2">{r.param}</td>
                      <td className="py-1.5 px-2 text-right">{r.trades}</td>
                      <td className="py-1.5 px-2 text-right">{r.winRate.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-red-500">-${r.maxDrawdown.toFixed(0)}</td>
                      <td
                        className="py-1.5 px-2 text-right font-medium"
                        style={{
                          background: `hsl(var(--${r.netPnl >= 0 ? "primary" : "destructive"}) / ${Math.min(
                            0.35,
                            Math.abs(r.netPnl) / 4000,
                          )})`,
                        }}
                      >
                        {fmtUsd(r.netPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground lowercase">belum dijalankan</p>
          )}
        </Card>
      )}

      {/* regime breakdown */}
      {regimeRows.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 lowercase">performa per regime market</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2 lowercase">regime</th>
                  <th className="text-right py-2 px-2 lowercase">trades</th>
                  <th className="text-right py-2 px-2 lowercase">win rate</th>
                  <th className="text-right py-2 px-2 lowercase">net pnl</th>
                </tr>
              </thead>
              <tbody>
                {regimeRows.map((r) => (
                  <tr key={r.regime} className="border-b border-border/40">
                    <td className="py-1.5 px-2 lowercase">{r.regime}</td>
                    <td className="py-1.5 px-2 text-right">{r.trades}</td>
                    <td className="py-1.5 px-2 text-right">{r.winRate.toFixed(1)}%</td>
                    <td className={`py-1.5 px-2 text-right font-medium ${r.net >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {fmtUsd(r.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* full trade log */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold lowercase">trade log lengkap</h2>
            <p className="text-[11px] text-muted-foreground lowercase">baris merah = 5 loss terbesar (audit gap / news event)</p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> export csv
          </Button>
        </div>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border sticky top-0 bg-card">
              <tr>
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2 lowercase">entry</th>
                <th className="text-left py-2 px-2 lowercase">exit</th>
                <th className="text-left py-2 px-2 lowercase">side</th>
                <th className="text-right py-2 px-2 lowercase">entry px</th>
                <th className="text-right py-2 px-2 lowercase">exit px</th>
                <th className="text-right py-2 px-2 lowercase">size</th>
                <th className="text-right py-2 px-2 lowercase">durasi</th>
                <th className="text-right py-2 px-2 lowercase">pnl gross</th>
                <th className="text-right py-2 px-2 lowercase">cost</th>
                <th className="text-right py-2 px-2 lowercase">pnl net</th>
                <th className="text-left py-2 px-2 lowercase">sinyal</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} className={`border-b border-border/40 ${worstKeys.has(i) ? "bg-destructive/10" : ""}`}>
                  <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{t.date} {t.time ?? ""}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{t.exitTime ?? "-"}</td>
                  <td className={`py-1.5 px-2 font-medium ${t.direction === "bullish" ? "text-emerald-500" : "text-red-500"}`}>
                    {t.direction === "bullish" ? "long" : "short"}
                  </td>
                  <td className="py-1.5 px-2 text-right">{t.entryFilled.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">{t.exitFilled.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">{t.qty.toFixed(2)}</td>
                  <td className="py-1.5 px-2 text-right">{t.time && t.exitTime ? `${t.time}→${t.exitTime}` : "-"}</td>
                  <td className={`py-1.5 px-2 text-right ${t.pnlGross >= 0 ? "text-emerald-500/80" : "text-red-500/80"}`}>{fmtUsd(t.pnlGross)}</td>
                  <td className="py-1.5 px-2 text-right text-muted-foreground">-${t.costTotal.toFixed(2)}</td>
                  <td className={`py-1.5 px-2 text-right font-semibold ${t.pnlNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtUsd(t.pnlNet)}</td>
                  <td className="py-1.5 px-2 lowercase text-[10px] text-muted-foreground">{t.reason ?? t.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default BacktesterAnalytics;
