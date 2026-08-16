import { useMemo, useState, type ReactNode } from "react";
import {
  computeQuantMetrics,
  DEFAULT_QUANT_SETTINGS,
  type QuantSettings,
  type QuantTrade,
} from "@/lib/quant-metrics";

interface Props {
  trades: QuantTrade[];
  settings?: QuantSettings;
  label: string;
  symbol?: string;
  dateRange?: string;
  /** rendered inside the "data analysis" tab */
  analysis?: ReactNode;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
const pct = (n: number, d = 2) => `${n.toFixed(d)}%`;

function Row({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" }) {
  return (
    <tr className="border-t border-border/40">
      <td className="px-2 py-[3px] text-muted-foreground">{k}</td>
      <td
        className={`px-2 py-[3px] text-right tabular-nums ${
          tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-destructive" : "text-foreground"
        }`}
      >
        {v}
      </td>
    </tr>
  );
}

function MetricTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-foreground lowercase mb-1">{title}</p>
      <table className="w-full text-[10.5px] border border-border/60 rounded overflow-hidden">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <th className="px-2 py-[3px] text-left font-medium">metric</th>
            <th className="px-2 py-[3px] text-right font-medium">value</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const BacktestReport = ({ trades, settings = DEFAULT_QUANT_SETTINGS, label, symbol, dateRange, analysis }: Props) => {
  const [tab, setTab] = useState<"overview" | "trades" | "analysis">("overview");
  const m = useMemo(() => computeQuantMetrics(trades, settings), [trades, settings]);
  const curve = m.perf.curve;

  const { equityPath, ddPath, W, H, HD } = useMemo(() => {
    const W = 900, H = 150, HD = 60;
    if (curve.length === 0) return { equityPath: "", ddPath: "", W, H, HD };
    const eq = curve.map((c) => c.equity);
    const lo = Math.min(m.perf.startEquity, ...eq);
    const hi = Math.max(m.perf.startEquity, ...eq);
    const pad = (hi - lo) * 0.1 || 1;
    const x = (i: number) => (curve.length === 1 ? W / 2 : (i / (curve.length - 1)) * (W - 4) + 2);
    const y = (v: number) => 4 + ((hi + pad - v) / (hi - lo + pad * 2)) * (H - 8);
    const equityPath = curve.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.equity).toFixed(1)}`).join(" ");

    let peak = m.perf.startEquity;
    const dd = curve.map((c) => {
      peak = Math.max(peak, c.equity);
      return peak > 0 ? ((c.equity - peak) / peak) * 100 : 0;
    });
    const worst = Math.min(-0.01, ...dd);
    const yd = (v: number) => 2 + (v / worst) * (HD - 4);
    const ddPath =
      `M${x(0).toFixed(1)},${yd(0).toFixed(1)} ` +
      dd.map((v, i) => `L${x(i).toFixed(1)},${yd(v).toFixed(1)}`).join(" ") +
      ` L${x(dd.length - 1).toFixed(1)},${yd(0).toFixed(1)} Z`;
    return { equityPath, ddPath, W, H, HD };
  }, [curve, m.perf.startEquity]);

  // monthly + yearly returns from equity curve
  const { monthly, years } = useMemo(() => {
    const monthly = new Map<string, number>();
    const years = new Map<string, number>();
    let prev = m.perf.startEquity;
    const monthStart = new Map<string, number>();
    const yearStart = new Map<string, number>();
    for (const p of curve) {
      const mk = p.date.slice(0, 7);
      const yk = p.date.slice(0, 4);
      if (!monthStart.has(mk)) monthStart.set(mk, prev);
      if (!yearStart.has(yk)) yearStart.set(yk, prev);
      monthly.set(mk, ((p.equity - monthStart.get(mk)!) / Math.max(1, monthStart.get(mk)!)) * 100);
      years.set(yk, ((p.equity - yearStart.get(yk)!) / Math.max(1, yearStart.get(yk)!)) * 100);
      prev = p.equity;
    }
    return { monthly, years };
  }, [curve, m.perf.startEquity]);

  const yearKeys = Array.from(years.keys()).sort();
  const heatColor = (v: number | undefined) => {
    if (v === undefined) return "bg-muted/20 text-muted-foreground";
    if (v > 1) return "bg-emerald-500/70 text-background";
    if (v > 0) return "bg-emerald-500/25 text-foreground";
    if (v < -1) return "bg-destructive/60 text-background";
    if (v < 0) return "bg-destructive/25 text-foreground";
    return "bg-muted/30 text-muted-foreground";
  };

  const sortedTrades = useMemo(() => [...trades].sort((a, b) => a.date.localeCompare(b.date)), [trades]);

  const TABS: { id: typeof tab; label: string }[] = [
    { id: "overview", label: "overview" },
    { id: "trades", label: "trades" },
    ...(analysis ? [{ id: "analysis" as const, label: "data analysis" }] : []),
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 pt-2.5 flex items-baseline justify-between gap-3">
        <p className="text-[12px] font-semibold text-foreground lowercase">backtest report: {label}</p>
        <p className="text-[10px] text-muted-foreground lowercase">
          {symbol?.toLowerCase()} {dateRange ? `· ${dateRange}` : ""} · {m.n} resolved trades
        </p>
      </div>

      <div className="px-3 mt-2 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 text-[11px] lowercase rounded-t border border-b-0 ${
              tab === t.id
                ? "bg-background border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="p-3 space-y-3">
          {/* equity + drawdown */}
          <div>
            <p className="text-[10px] text-muted-foreground lowercase mb-0.5">cumulative equity</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[130px]">
              <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="hsl(var(--border))" strokeWidth={0.5} />
              <path d={equityPath} fill="none" stroke="hsl(142 71% 45%)" strokeWidth={1.4} />
            </svg>
            <p className="text-[10px] text-muted-foreground lowercase mb-0.5">drawdown</p>
            <svg viewBox={`0 0 ${W} ${HD}`} className="w-full h-[56px]">
              <path d={ddPath} fill="hsl(var(--destructive) / 0.25)" stroke="hsl(var(--destructive))" strokeWidth={0.8} />
            </svg>
          </div>

          {/* monthly heatmap + yearly */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground lowercase mb-1">monthly returns (%)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[9px] tabular-nums">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-1 py-0.5 text-left font-medium" />
                      {MONTHS.map((mm) => (
                        <th key={mm} className="px-1 py-0.5 font-medium">{mm}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearKeys.map((y) => (
                      <tr key={y}>
                        <td className="px-1 py-0.5 text-muted-foreground">{y}</td>
                        {MONTHS.map((_, idx) => {
                          const key = `${y}-${String(idx + 1).padStart(2, "0")}`;
                          const v = monthly.get(key);
                          return (
                            <td key={key} className="p-[1px]">
                              <div className={`h-5 rounded-[2px] flex items-center justify-center ${heatColor(v)}`}>
                                {v === undefined ? "" : v.toFixed(1)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground lowercase mb-1">yearly returns (%)</p>
              <div className="space-y-1">
                {yearKeys.map((y) => {
                  const v = years.get(y)!;
                  const max = Math.max(1, ...yearKeys.map((k) => Math.abs(years.get(k)!)));
                  return (
                    <div key={y} className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-8">{y}</span>
                      <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
                        <div
                          className={`h-full ${v >= 0 ? "bg-emerald-500/70" : "bg-destructive/70"}`}
                          style={{ width: `${(Math.abs(v) / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-[9px] tabular-nums text-foreground w-12 text-right">{v.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* metric tables */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricTable title="time metrics">
              <Row k="start date" v={curve[0]?.date ?? "—"} />
              <Row k="end date" v={curve[curve.length - 1]?.date ?? "—"} />
              <Row k="trading days" v={String(m.tradingDays)} />
              <Row k="years" v={f2(m.perf.years)} />
              <Row k="exposure" v={pct(m.perf.exposurePct)} />
              <Row k="max dd duration" v={`${m.perf.maxDrawdownDurationDays} days`} />
              <Row k="in-sample ev" v={`${f2(m.inSample.netEvR)}r`} />
              <Row k="out-sample ev" v={`${f2(m.outSample.netEvR)}r`} />
              <Row k="edge status" v={m.decayStatus} />
            </MetricTable>

            <MetricTable title="performance metrics">
              <Row
                k="total return"
                v={`${usd(m.perf.netProfitDollar)} (${pct(m.perf.netProfitPct)})`}
                tone={m.perf.netProfitDollar >= 0 ? "pos" : "neg"}
              />
              <Row k="cagr" v={pct(m.perf.cagrPct)} />
              <Row k="sharpe ratio" v={f2(m.perf.sharpe)} />
              <Row k="sortino ratio" v={f2(m.perf.sortino)} />
              <Row k="calmar ratio" v={f2(m.perf.calmar)} />
              <Row k="profit factor" v={f2(m.profitFactorNet)} />
              <Row k="annual volatility" v={pct(m.perf.volatilityAnnualPct)} />
              <Row k="max drawdown" v={pct(m.perf.maxDrawdownPct)} tone="neg" />
              <Row k="max drawdown abs" v={usd(m.perf.maxDrawdownDollar)} />
              <Row k="recovery factor" v={f2(m.perf.recoveryFactor)} />
            </MetricTable>

            <MetricTable title="trade metrics">
              <Row k="number of trades" v={String(m.n)} />
              <Row k="trades per day" v={f2(m.perf.tradesPerDay)} />
              <Row k="win rate" v={pct(m.winRate, 1)} tone={m.winRate >= 50 ? "pos" : undefined} />
              <Row k="wilson 95% ci" v={`${m.ciLow.toFixed(1)}–${m.ciHigh.toFixed(1)}%`} />
              <Row k="win / loss" v={`${m.wins} / ${m.losses}`} />
              <Row k="avg win / loss" v={`${f2(m.avgWinR)}r / -${f2(m.avgLossR)}r`} />
              <Row k="expectancy (net)" v={`${f2(m.netEvR)}r · ${usd(m.netEvDollar)}`} tone={m.netEvR >= 0 ? "pos" : "neg"} />
              <Row k="best / worst trade" v={`${f2(m.perf.bestTradeR)}r / ${f2(m.perf.worstTradeR)}r`} />
              <Row k="max win / loss streak" v={`${m.perf.maxWinStreak} / ${m.perf.maxLossStreak}`} />
              <Row k="quarter kelly risk" v={usd(m.kellyRiskDollar)} />
            </MetricTable>
          </div>
        </div>
      )}

      {tab === "trades" && (
        <div className="p-3">
          <div className="max-h-[440px] overflow-auto rounded border border-border/60">
            <table className="w-full text-[10.5px] tabular-nums">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur text-muted-foreground lowercase">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">#</th>
                  <th className="px-2 py-1 text-left font-medium">date</th>
                  <th className="px-2 py-1 text-left font-medium">side</th>
                  <th className="px-2 py-1 text-right font-medium">entry</th>
                  <th className="px-2 py-1 text-right font-medium">risk (pts)</th>
                  <th className="px-2 py-1 text-right font-medium">r</th>
                  <th className="px-2 py-1 text-left font-medium">outcome</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrades.map((t, i) => (
                  <tr key={`${t.date}-${i}`} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1 text-foreground">{t.date}</td>
                    <td className={`px-2 py-1 ${t.side === "long" ? "text-emerald-500" : "text-destructive"}`}>{t.side}</td>
                    <td className="px-2 py-1 text-right text-foreground">{t.entry.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right text-foreground">{t.risk.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right text-foreground">
                      {t.rMultiple === undefined ? "—" : `${t.rMultiple.toFixed(2)}r`}
                    </td>
                    <td
                      className={`px-2 py-1 ${
                        t.outcome === "win"
                          ? "text-emerald-500"
                          : t.outcome === "loss"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {t.outcome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "analysis" && <div className="p-3 space-y-3">{analysis}</div>}
    </div>
  );
};

export default BacktestReport;
