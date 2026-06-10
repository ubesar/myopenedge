import ContinuationStackCard from "@/components/ContinuationStackCard";
import type { IBPullbackResult, IBPullbackSideStats, PullbackLevel } from "@/lib/ib-pullback-analysis";

interface Props {
  result: IBPullbackResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
  stopMode?: "ib-extreme" | "next-level";
}

const LEVELS: PullbackLevel[] = [25, 50, 75];

const buildColumns = (side: IBPullbackSideStats) =>
  LEVELS.map((lvl) => {
    const s = side.levels[lvl];
    const resolved = s.wins + s.losses;
    const winPct = resolved > 0 ? (s.wins / resolved) * 100 : 0;
    const lossPct = resolved > 0 ? (s.losses / resolved) * 100 : 0;
    return {
      label: `IB ${lvl}%`,
      bottomPct: winPct,
      topPct: lossPct,
      bottomLabel: "win",
      topLabel: "loss",
      total: resolved,
    };
  });

const IBPullbackDashboard = ({ result, symbol, dateRange, weekdays, stopMode = "ib-extreme" }: Props) => {
  const longCols = buildColumns(result.longSide);
  const shortCols = buildColumns(result.shortSide);

  const slDescription = stopMode === "next-level"
    ? "next pullback level (25→50, 50→75, 75→IB extreme)"
    : "IB 100% (opposite IB extreme)";

  const settings = (formedFirst: string) => [
    { label: "IB window", value: `${result.ibWindowMinutes} min` },
    { label: "session", value: "09:30 – 16:00 ET" },
    { label: "candle timeframe", value: "5min" },
    { label: "formed first", value: formedFirst },
    { label: "TP", value: "IB 0% (same-side IB extreme)" },
    { label: "SL", value: slDescription },
    { label: "entry trigger", value: "touch level" },
    { label: "date range", value: dateRange },
    { label: "weekdays", value: weekdays },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
        <strong className="text-foreground">IB pullback strategy</strong> — when <em>IB low forms first</em> → look for <span className="text-buy font-medium">long</span> at 25/50/75% pullback. when <em>IB high forms first</em> → look for <span className="text-sell font-medium">short</span>. TP = IB 0% (same-side extreme). SL = {slDescription}.
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-2">
          <ContinuationStackCard
            title="long setups (IB low formed first)"
            subtitle={`${symbol} · ${result.longSide.total} qualifying days`}
            columns={longCols}
            legend={[
              { label: "% win (hit IB 0%)", colorClass: "bg-chart-bar-a" },
              { label: "% loss (hit IB 100%)", colorClass: "bg-chart-bar-b" },
            ]}
          />
          <div className="rounded-lg border border-border bg-card px-4 py-2 text-[11px] grid grid-cols-3 gap-2 text-center">
            {LEVELS.map((lvl) => {
              const s = result.longSide.levels[lvl];
              return (
                <div key={lvl}>
                  <p className="text-muted-foreground">IB {lvl}% trigger</p>
                  <p className="text-foreground font-mono">{s.triggerRate.toFixed(0)}% ({s.triggered}/{result.longSide.total})</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <ContinuationStackCard
            title="short setups (IB high formed first)"
            subtitle={`${symbol} · ${result.shortSide.total} qualifying days`}
            columns={shortCols}
            legend={[
              { label: "% win (hit IB 0%)", colorClass: "bg-chart-bar-a" },
              { label: "% loss (hit IB 100%)", colorClass: "bg-chart-bar-b" },
            ]}
          />
          <div className="rounded-lg border border-border bg-card px-4 py-2 text-[11px] grid grid-cols-3 gap-2 text-center">
            {LEVELS.map((lvl) => {
              const s = result.shortSide.levels[lvl];
              return (
                <div key={lvl}>
                  <p className="text-muted-foreground">IB {lvl}% trigger</p>
                  <p className="text-foreground font-mono">{s.triggerRate.toFixed(0)}% ({s.triggered}/{result.shortSide.total})</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overall combined */}
      <ContinuationStackCard
        title="overall (long + short combined)"
        subtitle={`${symbol} · ${result.totalDays} total days · ${dateRange} · ${weekdays}`}
        columns={LEVELS.map((lvl) => {
          const s = result.overall[lvl];
          const resolved = s.wins + s.losses;
          const winPct = resolved > 0 ? (s.wins / resolved) * 100 : 0;
          const lossPct = resolved > 0 ? (s.losses / resolved) * 100 : 0;
          return {
            label: `IB ${lvl}%`,
            bottomPct: winPct,
            topPct: lossPct,
            bottomLabel: "win",
            topLabel: "loss",
            total: resolved,
          };
        })}
        legend={[
          { label: "% win", colorClass: "bg-chart-bar-a" },
          { label: "% loss", colorClass: "bg-chart-bar-b" },
        ]}
      />

      {/* Settings */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h5 className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {settings("see split above").map((s) => (
            <div key={s.label} className="flex justify-between">
              <span className="text-muted-foreground">{s.label}:</span>
              <span className="text-primary font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trades history */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-[13px] font-semibold text-foreground mb-3 lowercase">IB pullback trade history</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">date</th>
                <th className="text-left py-2 pr-3">side</th>
                <th className="text-right py-2 pr-3">level</th>
                <th className="text-right py-2 pr-3">entry</th>
                <th className="text-right py-2 pr-3">stop</th>
                <th className="text-right py-2 pr-3">target</th>
                <th className="text-left py-2 pr-3">trigger</th>
                <th className="text-left py-2 pr-3">resolved</th>
                <th className="text-left py-2">outcome</th>
              </tr>
            </thead>
            <tbody>
              {[...result.trades].reverse().slice(0, 200).map((t, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 text-foreground">{t.date}</td>
                  <td className={`py-1.5 pr-3 font-medium ${t.side === "long" ? "text-emerald-500" : "text-red-500"}`}>{t.side}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">IB {t.level}%</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.entry.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.stop.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.target.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.triggerTime || "—"}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.resolvedTime || "—"}</td>
                  <td className={`py-1.5 font-medium ${
                    t.outcome === "win" ? "text-emerald-500"
                    : t.outcome === "loss" ? "text-red-500"
                    : "text-muted-foreground"
                  }`}>{t.outcome}</td>
                </tr>
              ))}
              {result.trades.length === 0 && (
                <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">no trades</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default IBPullbackDashboard;
