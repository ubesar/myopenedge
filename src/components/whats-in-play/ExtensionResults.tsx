import { ArrowUpRight, ArrowDownRight, Target, BarChart3, Calendar, TrendingUp, RefreshCw } from "lucide-react";
import ChartCard from "@/components/ChartCard";
import type { ExtensionResult } from "@/lib/ib-extension-analysis";

interface Props {
  result: ExtensionResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

export default function ExtensionResults({ result, symbol, dateRange, weekdays }: Props) {
  const { totalDays, bullishBreaks, bearishBreaks, noBreaks, ext25, ext50, ext100 } = result;
  const breakDays = bullishBreaks + bearishBreaks;

  return (
    <div className="space-y-4">
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="days analyzed"
          value={String(totalDays)}
        />
        <StatBox
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="IB breaks"
          value={`${breakDays} / ${totalDays}`}
        />
        <StatBox
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          label="bullish breaks"
          value={String(bullishBreaks)}
          highlight="profit"
        />
        <StatBox
          icon={<ArrowDownRight className="h-3.5 w-3.5" />}
          label="bearish breaks"
          value={String(bearishBreaks)}
          highlight="loss"
        />
      </div>

      {/* Extension reach chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="IB extension reach rate"
          subtitle={`${symbol} · how far does price extend beyond IB?`}
          totalDays={breakDays}
          bars={[
            { name: "25% ext", value: ext25.reachedPct, color: "primary" },
            { name: "50% ext", value: ext50.reachedPct, color: "primary" },
            { name: "100% ext", value: ext100.reachedPct, color: "muted" },
          ]}
          legendItems={[
            { label: "reached extension level", color: "hsl(217,91%,60%)" },
          ]}
          settingsGrid={[
            { label: "IB window", value: `${result.ibWindow} min` },
            { label: "pullback window", value: `${result.pullbackWindow} min after breakout` },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />

        <ChartCard
          title="pullback to IB 50% rate"
          subtitle={`${symbol} · price returns to IB midpoint after extension`}
          totalDays={breakDays}
          bars={[
            { name: "25% ext", value: ext25.withPullbackPct, color: "primary" },
            { name: "50% ext", value: ext50.withPullbackPct, color: "primary" },
            { name: "100% ext", value: ext100.withPullbackPct, color: "muted" },
          ]}
          legendItems={[
            { label: "pulled back to IB 50%", color: "hsl(217,91%,60%)" },
          ]}
          settingsGrid={[
            { label: "pullback target", value: "IB 50% (midpoint)" },
            { label: "pullback window", value: `within ${result.pullbackWindow} min` },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />
      </div>

      {/* Continuation after pullback */}
      <ChartCard
        title="continuation after pullback"
        subtitle={`${symbol} · does price resume breakout after pulling back to IB 50%?`}
        totalDays={breakDays}
        bars={[
          { name: "25% ext", value: ext25.continuationPct, color: "primary" },
          { name: "50% ext", value: ext50.continuationPct, color: "primary" },
          { name: "100% ext", value: ext100.continuationPct, color: "muted" },
        ]}
        legendItems={[
          { label: "continued in breakout direction", color: "hsl(217,91%,60%)" },
        ]}
        settingsGrid={[
          { label: "continuation definition", value: "close beyond IB level" },
          { label: "IB window", value: `${result.ibWindow} min` },
          { label: "pullback window", value: `${result.pullbackWindow} min` },
          { label: "date range", value: dateRange },
          { label: "weekdays", value: weekdays },
        ]}
      />

      {/* Detailed breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ExtLevelCard label="25% extension" stats={ext25} breakDays={breakDays} />
        <ExtLevelCard label="50% extension" stats={ext50} breakDays={breakDays} />
        <ExtLevelCard label="100% extension" stats={ext100} breakDays={breakDays} />
      </div>

      {/* Day-by-day detail */}
      <details className="rounded-xl border border-border bg-card/50">
        <summary className="px-4 py-3 text-[11px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          day-by-day breakdown ({result.details.length} days)
        </summary>
        <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 font-semibold">date</th>
                <th className="text-center py-2 font-semibold">break</th>
                <th className="text-center py-2 font-semibold">25%</th>
                <th className="text-center py-2 font-semibold">50%</th>
                <th className="text-center py-2 font-semibold">100%</th>
                <th className="text-center py-2 font-semibold">pullback</th>
                <th className="text-center py-2 font-semibold">cont.</th>
              </tr>
            </thead>
            <tbody>
              {result.details.map((d) => (
                <tr key={d.date} className="border-b border-border/50">
                  <td className="py-1.5 text-foreground">{d.date}</td>
                  <td className="text-center">
                    {d.breakDirection === "bullish" ? (
                      <span className="text-profit">▲</span>
                    ) : d.breakDirection === "bearish" ? (
                      <span className="text-loss">▼</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="text-center">{d.reached25 ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground/40">—</span>}</td>
                  <td className="text-center">{d.reached50 ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground/40">—</span>}</td>
                  <td className="text-center">{d.reached100 ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground/40">—</span>}</td>
                  <td className="text-center">{d.pulledBackToIB50 ? <RefreshCw className="h-3 w-3 text-amber-400 inline" /> : <span className="text-muted-foreground/40">—</span>}</td>
                  <td className="text-center">
                    {d.pulledBackToIB50 ? (
                      d.continuedAfterPullback ? (
                        <span className="text-profit font-bold">cont.</span>
                      ) : (
                        <span className="text-loss font-bold">rev.</span>
                      )
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function StatBox({
  icon, label, value, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: "profit" | "loss";
}) {
  const valColor = highlight === "profit" ? "text-profit" : highlight === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-semibold">{label}</span>
      </div>
      <p className={`text-[18px] font-bold ${valColor}`}>{value}</p>
    </div>
  );
}

function ExtLevelCard({ label, stats, breakDays }: { label: string; stats: import("@/lib/ib-extension-analysis").ExtensionLevelStats; breakDays: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{label}</p>
      <div className="space-y-2">
        <Row label="reached" value={`${stats.reached} / ${breakDays}`} pct={stats.reachedPct} />
        <Row label="pulled back to IB 50%" value={`${stats.withPullback} / ${stats.reached}`} pct={stats.withPullbackPct} />
        <Row label="continued after pullback" value={`${stats.continuedAfterPullback} / ${stats.withPullback}`} pct={stats.continuationPct} color="profit" />
      </div>
    </div>
  );
}

function Row({ label, value, pct, color }: { label: string; value: string; pct: number; color?: string }) {
  const pctColor = color === "profit" ? "text-profit" : "text-foreground";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${pctColor}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-[9px] text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}
