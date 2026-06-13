import ContinuationStackCard from "@/components/ContinuationStackCard";
import type { MFPResult } from "@/lib/momentum-fib-pullback-analysis";

interface Props {
  result: MFPResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

const MomentumFibPullbackDashboard = ({ result, symbol, dateRange, weekdays }: Props) => {
  const s = result.tfStats.M15;

  const overallResolved = s.wins + s.losses;
  const overallCols = [{
    label: "M15",
    bottomPct: overallResolved > 0 ? (s.wins / overallResolved) * 100 : 0,
    topPct: overallResolved > 0 ? (s.losses / overallResolved) * 100 : 0,
    bottomLabel: "win", topLabel: "loss", total: overallResolved,
  }];

  const longResolved = s.longWins + s.longLosses;
  const shortResolved = s.shortWins + s.shortLosses;
  const sideCols = [
    {
      label: "long",
      bottomPct: longResolved > 0 ? (s.longWins / longResolved) * 100 : 0,
      topPct: longResolved > 0 ? (s.longLosses / longResolved) * 100 : 0,
      bottomLabel: "win", topLabel: "loss", total: longResolved,
    },
    {
      label: "short",
      bottomPct: shortResolved > 0 ? (s.shortWins / shortResolved) * 100 : 0,
      topPct: shortResolved > 0 ? (s.shortLosses / shortResolved) * 100 : 0,
      bottomLabel: "win", topLabel: "loss", total: shortResolved,
    },
  ];

  const settings = [
    { label: "timeframe", value: "M15 only" },
    { label: "super body filter", value: `body > sma(body,${result.avgPeriod}) × ${result.superMultiplier}` },
    { label: "C1 window", value: "09:30 – 10:30 ET" },
    { label: "TP/SL window", value: "until 16:00 ET" },
    { label: "entry", value: "stop order at C1 high/low (after C2 touches fib 0.2)" },
    { label: "stop loss", value: "C2 wick (low for long / high for short)" },
    { label: "take profit", value: "RR 1:2 (entry ± 2× risk)" },
    { label: "date range", value: dateRange },
    { label: "weekdays", value: weekdays },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-foreground/80 leading-relaxed">
        <strong className="text-foreground">momentum candle fib pullback · M15</strong> — find a super-body momentum candle (C1) between 09:30–10:30 ET. The very next M15 candle (C2) must (1) pullback to <span className="font-medium">fib 0.2</span> and (2) trigger the stop order at C1's high/low in the same bar. Otherwise skip and look for the next C1. <span className="font-medium">SL = C2 wick</span>, <span className="font-medium">TP = RR 1:2</span>. Resolution allowed until 16:00 ET.
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ContinuationStackCard
          title="overall win/loss (M15)"
          subtitle={`${symbol} · ${result.totalDays} days · ${dateRange} · ${weekdays}`}
          columns={overallCols}
          legend={[
            { label: "% win (TP hit)", colorClass: "bg-chart-bar-a" },
            { label: "% loss (SL hit)", colorClass: "bg-chart-bar-b" },
          ]}
        />
        <ContinuationStackCard
          title="long vs short"
          subtitle={`${symbol} · win/loss by side`}
          columns={sideCols}
          legend={[
            { label: "% win", colorClass: "bg-chart-bar-a" },
            { label: "% loss", colorClass: "bg-chart-bar-b" },
          ]}
        />
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-[12px] font-semibold text-foreground mb-3 lowercase">funnel (M15)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">tf</th>
                <th className="text-right py-2 pr-3">super candles</th>
                <th className="text-right py-2 pr-3">bull / bear</th>
                <th className="text-right py-2 pr-3">C2 hit 0.2</th>
                <th className="text-right py-2 pr-3">triggered</th>
                <th className="text-right py-2 pr-3">wins</th>
                <th className="text-right py-2 pr-3">losses</th>
                <th className="text-right py-2">win rate</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="py-1.5 pr-3 font-medium text-foreground">M15</td>
                <td className="py-1.5 pr-3 text-right font-mono">{s.momentumCandles}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{s.bullishMomentum} / {s.bearishMomentum}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{s.pullbackHits} <span className="text-muted-foreground">({s.pullbackRate.toFixed(0)}%)</span></td>
                <td className="py-1.5 pr-3 text-right font-mono">{s.triggered} <span className="text-muted-foreground">({s.triggerRate.toFixed(0)}%)</span></td>
                <td className="py-1.5 pr-3 text-right font-mono text-emerald-500">{s.wins}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-red-500">{s.losses}</td>
                <td className="py-1.5 text-right font-mono font-semibold">{s.winRate.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h5 className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {settings.map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-muted-foreground">{row.label}:</span>
              <span className="text-primary font-medium text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trade history */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-[13px] font-semibold text-foreground mb-3 lowercase">trade history — C1 OHLC, C2 SL/TP levels</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">date</th>
                <th className="text-left py-2 pr-3">side</th>
                <th className="text-left py-2 pr-3">C1 time</th>
                <th className="text-right py-2 pr-3">C1 O</th>
                <th className="text-right py-2 pr-3">C1 H</th>
                <th className="text-right py-2 pr-3">C1 L</th>
                <th className="text-right py-2 pr-3">C1 C</th>
                <th className="text-left py-2 pr-3">C2 time</th>
                <th className="text-right py-2 pr-3">entry</th>
                <th className="text-right py-2 pr-3">SL (C2)</th>
                <th className="text-right py-2 pr-3">TP (1:2)</th>
                <th className="text-right py-2 pr-3">risk</th>
                <th className="text-left py-2 pr-3">resolved</th>
                <th className="text-left py-2">outcome</th>
              </tr>
            </thead>
            <tbody>
              {[...result.trades].reverse().slice(0, 300).map((t, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 text-foreground">{t.date}</td>
                  <td className={`py-1.5 pr-3 font-medium ${t.side === "long" ? "text-emerald-500" : "text-red-500"}`}>{t.side}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.momentumTime}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.c1Open.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.c1High.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.c1Low.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.c1Close.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.c2Time}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{t.entry.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-red-400">{t.sl.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-emerald-400">{t.tp.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{t.risk.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{t.resolvedTime || "—"}</td>
                  <td className={`py-1.5 font-medium ${
                    t.outcome === "win" ? "text-emerald-500"
                    : t.outcome === "loss" ? "text-red-500"
                    : "text-muted-foreground"
                  }`}>{t.outcome}</td>
                </tr>
              ))}
              {result.trades.length === 0 && (
                <tr><td colSpan={14} className="py-4 text-center text-muted-foreground">no trades</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MomentumFibPullbackDashboard;
