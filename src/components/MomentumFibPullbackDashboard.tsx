import ContinuationStackCard from "@/components/ContinuationStackCard";
import type { MFPResult, MFPTimeframe } from "@/lib/momentum-fib-pullback-analysis";

interface Props {
  result: MFPResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

const TFS: MFPTimeframe[] = ["M5", "M15", "M30", "H1"];

const MomentumFibPullbackDashboard = ({ result, symbol, dateRange, weekdays }: Props) => {
  const allCols = TFS.map((tf) => {
    const s = result.tfStats[tf];
    const resolved = s.wins + s.losses;
    const winPct = resolved > 0 ? (s.wins / resolved) * 100 : 0;
    const lossPct = resolved > 0 ? (s.losses / resolved) * 100 : 0;
    return {
      label: tf, bottomPct: winPct, topPct: lossPct,
      bottomLabel: "win", topLabel: "loss", total: resolved,
    };
  });

  const longCols = TFS.map((tf) => {
    const s = result.tfStats[tf];
    const resolved = s.longWins + s.longLosses;
    const winPct = resolved > 0 ? (s.longWins / resolved) * 100 : 0;
    const lossPct = resolved > 0 ? (s.longLosses / resolved) * 100 : 0;
    return { label: tf, bottomPct: winPct, topPct: lossPct, bottomLabel: "win", topLabel: "loss", total: resolved };
  });

  const shortCols = TFS.map((tf) => {
    const s = result.tfStats[tf];
    const resolved = s.shortWins + s.shortLosses;
    const winPct = resolved > 0 ? (s.shortWins / resolved) * 100 : 0;
    const lossPct = resolved > 0 ? (s.shortLosses / resolved) * 100 : 0;
    return { label: tf, bottomPct: winPct, topPct: lossPct, bottomLabel: "win", topLabel: "loss", total: resolved };
  });

  const settings = [
    { label: "super body filter", value: `body > sma(body,${result.avgPeriod}) × ${result.superMultiplier}` },
    { label: "session", value: "09:30 – 16:00 ET" },
    { label: "entry trigger", value: "stop order at fib 0 after fib 0.2 touch" },
    { label: "TP / SL", value: "fib -0.5 / fib 0.5" },
    { label: "RR", value: "1 : 1 (0.5 risk : 0.5 reward of C1 range)" },
    { label: "date range", value: dateRange },
    { label: "weekdays", value: weekdays },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
        <strong className="text-foreground">momentum candle fib pullback</strong> — detect a super-body momentum candle (C1). draw fib using C1 range. wait for next candle(s) to pull back into <span className="font-medium">fib 0.2</span>, then place a <span className="text-buy font-medium">buy stop</span> (bullish C1) or <span className="text-sell font-medium">sell stop</span> (bearish C1) at <span className="font-medium">fib 0</span> (C1 high/low). <span className="font-medium">SL = fib 0.5</span>, <span className="font-medium">TP = fib -0.5</span>.
      </div>

      <ContinuationStackCard
        title="overall win/loss by timeframe"
        subtitle={`${symbol} · ${result.totalDays} days · ${dateRange} · ${weekdays}`}
        columns={allCols}
        legend={[
          { label: "% win (TP hit)", colorClass: "bg-chart-bar-a" },
          { label: "% loss (SL hit)", colorClass: "bg-chart-bar-b" },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ContinuationStackCard
          title="long setups (bullish momentum)"
          subtitle={`${symbol} · win/loss by TF`}
          columns={longCols}
          legend={[
            { label: "% win", colorClass: "bg-chart-bar-a" },
            { label: "% loss", colorClass: "bg-chart-bar-b" },
          ]}
        />
        <ContinuationStackCard
          title="short setups (bearish momentum)"
          subtitle={`${symbol} · win/loss by TF`}
          columns={shortCols}
          legend={[
            { label: "% win", colorClass: "bg-chart-bar-a" },
            { label: "% loss", colorClass: "bg-chart-bar-b" },
          ]}
        />
      </div>

      {/* Funnel per TF */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-[12px] font-semibold text-foreground mb-3 lowercase">funnel per timeframe</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">tf</th>
                <th className="text-right py-2 pr-3">super candles</th>
                <th className="text-right py-2 pr-3">bull / bear</th>
                <th className="text-right py-2 pr-3">pulled back to 0.2</th>
                <th className="text-right py-2 pr-3">triggered (fib 0)</th>
                <th className="text-right py-2 pr-3">wins</th>
                <th className="text-right py-2 pr-3">losses</th>
                <th className="text-right py-2">win rate</th>
              </tr>
            </thead>
            <tbody>
              {TFS.map((tf) => {
                const s = result.tfStats[tf];
                return (
                  <tr key={tf} className="border-b border-border/40">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{tf}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{s.momentumCandles}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{s.bullishMomentum} / {s.bearishMomentum}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{s.pullbackHits} <span className="text-muted-foreground">({s.pullbackRate.toFixed(0)}%)</span></td>
                    <td className="py-1.5 pr-3 text-right font-mono">{s.triggered} <span className="text-muted-foreground">({s.triggerRate.toFixed(0)}%)</span></td>
                    <td className="py-1.5 pr-3 text-right font-mono text-emerald-500">{s.wins}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-red-500">{s.losses}</td>
                    <td className="py-1.5 text-right font-mono font-semibold">{s.winRate.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h5 className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {settings.map((s) => (
            <div key={s.label} className="flex justify-between">
              <span className="text-muted-foreground">{s.label}:</span>
              <span className="text-primary font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trade history */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-[13px] font-semibold text-foreground mb-3 lowercase">momentum fib pullback trade history</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">date</th>
                <th className="text-left py-2 pr-3">tf</th>
                <th className="text-left py-2 pr-3">side</th>
                <th className="text-left py-2 pr-3">c1</th>
                <th className="text-left py-2 pr-3">pullback</th>
                <th className="text-left py-2 pr-3">trigger</th>
                <th className="text-right py-2 pr-3">entry</th>
                <th className="text-right py-2 pr-3">sl</th>
                <th className="text-right py-2 pr-3">tp</th>
                <th className="text-left py-2">outcome</th>
              </tr>
            </thead>
            <tbody>
              {[...result.trades].reverse().slice(0, 250).map((t, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 text-foreground">{t.date}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.tf}</td>
                  <td className={`py-1.5 pr-3 font-medium ${t.side === "long" ? "text-emerald-500" : "text-red-500"}`}>{t.side}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.momentumTime}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.pullbackTime || "—"}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.triggerTime || "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.entry.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.fib05.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.fibNeg05.toFixed(2)}</td>
                  <td className={`py-1.5 font-medium ${
                    t.outcome === "win" ? "text-emerald-500"
                    : t.outcome === "loss" ? "text-red-500"
                    : "text-muted-foreground"
                  }`}>{t.outcome}</td>
                </tr>
              ))}
              {result.trades.length === 0 && (
                <tr><td colSpan={10} className="py-4 text-center text-muted-foreground">no trades</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MomentumFibPullbackDashboard;
