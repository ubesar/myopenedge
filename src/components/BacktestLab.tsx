import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { NYOrbDay } from "@/lib/ny-orb-m15";
import {
  buildExecTrades,
  buyAndHoldCurve,
  classifyRegimes,
  computeRiskMetrics,
  summarize,
  DEFAULT_EXEC,
  type ExecConfig,
} from "@/lib/backtest-engine";
import ExecutionPanel from "./backtest/ExecutionPanel";
import MetricCard from "./backtest/MetricCard";
import EquityChart from "./backtest/EquityChart";
import TradeLogTable from "./backtest/TradeLogTable";
import RobustnessPanel, { type ParamVariant } from "./backtest/RobustnessPanel";

interface Props {
  days: NYOrbDay[];
  variants: { param: number; days: NYOrbDay[] }[];
  baseParam: number;
  symbol: string;
}

const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(0)}`;
const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "∞");

const BacktestLab = ({ days, variants, baseParam, symbol }: Props) => {
  const [cfg, setCfg] = useState<ExecConfig>(DEFAULT_EXEC);

  const trades = useMemo(() => buildExecTrades(days, cfg), [days, cfg]);
  const m = useMemo(() => computeRiskMetrics(trades, cfg), [trades, cfg]);
  const bench = useMemo(() => buyAndHoldCurve(days, cfg), [days, cfg]);
  const regimes = useMemo(() => classifyRegimes(days), [days]);

  const variantTrades: ParamVariant[] = useMemo(
    () => variants.map((v) => ({ param: v.param, label: v.param.toFixed(2), trades: buildExecTrades(v.days, cfg) })),
    [variants, cfg],
  );

  const regimeRows = useMemo(() => {
    const groups = new Map<string, typeof trades>();
    for (const t of trades) {
      const r = regimes.get(t.date) ?? "sideways";
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(t);
    }
    return Array.from(groups.entries()).map(([regime, rows]) => ({ regime, ...summarize(rows) }));
  }, [trades, regimes]);

  const costApplied = cfg.slippageTicks > 0 || cfg.commissionPerContract > 0 || cfg.commissionPerTrade > 0;
  const holdPct = bench.length ? bench[bench.length - 1].pct : 0;

  if (!trades.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-[12px] text-muted-foreground lowercase">
        belum ada trade untuk dianalisa.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[13px] font-semibold text-foreground lowercase">backtest lab — realistic execution</h4>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
          costApplied ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10" : "border-amber-500/40 text-amber-500 bg-amber-500/10"
        }`}>
          {costApplied ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {costApplied ? "net result — slippage & commission applied" : "gross result — belum dikurangi slippage/komisi"}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground inline-flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> no-lookahead: sinyal dari bar closed, fill divalidasi range bar
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
          static snapshot — hasil deterministik (no repaint indicator)
        </span>
      </div>

      <ExecutionPanel cfg={cfg} onChange={setCfg} />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard label="gross pnl" value={money(m.grossPnl)} tone={m.grossPnl >= 0 ? "pos" : "neg"} hint="p&l sebelum slippage dan komisi." />
        <MetricCard label="net pnl" value={money(m.netPnl)} tone={m.netPnl >= 0 ? "pos" : "neg"} sub={`cost ${money(m.costTotal)}`} hint="p&l setelah slippage + komisi. inilah hasil realistis." />
        <MetricCard label="win rate" value={`${fmt(m.winRate, 1)}%`} sub={`${m.wins}w / ${m.losses}l`} hint="persentase trade net-positif." />
        <MetricCard label="profit factor" value={fmt(m.profitFactor)} hint="total profit / total loss (net)." />
        <MetricCard label="expectancy" value={money(m.expectancy)} tone={m.expectancy >= 0 ? "pos" : "neg"} hint="rata-rata net p&l per trade." />
        <MetricCard label="cagr" value={`${fmt(m.cagr, 1)}%`} hint="compound annual growth rate dari equity curve: (equity akhir / awal)^(1/tahun) − 1." />
        <MetricCard label="sharpe" value={fmt(m.sharpe)} hint="(rata-rata return − risk free) / stdev return, dianualisasi. > 1 bagus." />
        <MetricCard label="sortino" value={fmt(m.sortino)} hint="seperti sharpe tapi hanya memakai downside deviation (volatilitas rugi)." />
        <MetricCard label="calmar" value={fmt(m.calmar)} hint="cagr / max drawdown %. mengukur return per unit drawdown." />
        <MetricCard label="recovery factor" value={fmt(m.recoveryFactor)} hint="net profit / max drawdown. semakin tinggi semakin cepat pulih." />
        <MetricCard label="max drawdown" value={money(-m.maxDrawdown)} tone="neg" sub={`${fmt(m.maxDrawdownPct, 1)}% akun`} hint="penurunan equity terbesar dari puncak sebelumnya." />
        <MetricCard label="max dd duration" value={`${m.maxDdDurationDays}d`} sub={`${m.maxDdDurationTrades} trades`} hint="durasi terlama equity berada di bawah puncak sebelumnya." />
        <MetricCard label="win streak" value={String(m.longestWinStreak)} tone="pos" hint="trade menang beruntun terpanjang." />
        <MetricCard label="loss streak" value={String(m.longestLossStreak)} tone="neg" hint="trade rugi beruntun terpanjang." />
        <MetricCard label="buy & hold" value={`${fmt(holdPct, 1)}%`} hint={`return pasif hold ${symbol.toLowerCase()} pada periode yang sama.`} />
        <MetricCard label="strategy return" value={`${fmt((m.netPnl / cfg.accountSize) * 100, 1)}%`} tone={m.netPnl >= 0 ? "pos" : "neg"} hint="net p&l dibagi account size." />
      </div>

      <EquityChart equity={m.equity} benchmark={bench} accountSize={cfg.accountSize} symbol={symbol} />

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[12px] font-medium text-foreground lowercase mb-2">performa per regime market</p>
        <table className="w-full text-[11px]">
          <thead className="text-muted-foreground">
            <tr>{["regime", "trades", "win %", "net pnl", "max dd"].map((h) => <th key={h} className="text-left font-normal lowercase py-1">{h}</th>)}</tr>
          </thead>
          <tbody className="font-mono">
            {regimeRows.map((r) => (
              <tr key={r.regime} className="border-t border-border/50">
                <td className="py-1">{r.regime}</td>
                <td>{r.n}</td>
                <td>{r.winRate.toFixed(1)}</td>
                <td className={r.net >= 0 ? "text-emerald-500" : "text-destructive"}>{money(r.net)}</td>
                <td className="text-destructive">{money(-r.maxDd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RobustnessPanel trades={trades} variants={variantTrades} cfg={cfg} baseParam={baseParam} />

      <TradeLogTable trades={trades} symbol={symbol} regimes={regimes} />
    </div>
  );
};

export default BacktestLab;
