import { ArrowUpRight, ArrowDownRight, Target, BarChart3, Calendar, TrendingUp } from "lucide-react";
import type { ComboResult, ConditionConfig } from "@/lib/combo-analysis";

interface Props {
  result: ComboResult;
  condA: ConditionConfig;
  condB: ConditionConfig;
  symbol: string;
}

function condLabel(c: ConditionConfig): string {
  switch (c.type) {
    case "ib_breakout": return `IB Breakout ${c.window}m (${c.direction})`;
    case "bb_breakout": return `BB ${c.band} ${c.timeframe}m (${c.timing.replace("_", " ")})`;
    case "momentum_candle": return `MC ${(c.bodyRatio * 100).toFixed(0)}% (${c.direction})`;
    case "occ": return `OCC ${c.timeframe}m (${c.direction})`;
  }
}

export default function ComboResults({ result, condA, condB, symbol }: Props) {
  const { totalDays, condAFired, condBFired, bothFired, continuation, continuationPct, reversalPct, avgContinuationSize } = result;

  const edge = continuationPct >= 60 ? "strong" : continuationPct >= 50 ? "moderate" : "weak";
  const edgeColor = edge === "strong" ? "text-profit" : edge === "weak" ? "text-loss" : "text-amber-400";
  const edgeBg = edge === "strong" ? "bg-profit/10" : edge === "weak" ? "bg-loss/10" : "bg-amber-400/10";

  return (
    <div className="space-y-4">
      {/* Main result card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-[14px] font-bold text-foreground uppercase tracking-wide">{symbol} combo result</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {condLabel(condA)} + {condLabel(condB)}
            </p>
          </div>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${edgeBg} ${edgeColor}`}>
            <Target className="h-3.5 w-3.5" />
            {edge} edge
          </div>
        </div>

        {/* Big number */}
        <div className="text-center py-4">
          <p className={`text-[56px] font-black leading-none ${edgeColor}`}>
            {continuationPct.toFixed(1)}%
          </p>
          <p className="text-[12px] text-muted-foreground mt-2">continuation rate</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="days analyzed"
            value={String(totalDays)}
          />
          <StatBox
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="both fired"
            value={`${bothFired} / ${totalDays}`}
          />
          <StatBox
            icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            label="continuation"
            value={`${continuation} days`}
            highlight="profit"
          />
          <StatBox
            icon={<ArrowDownRight className="h-3.5 w-3.5" />}
            label="reversal"
            value={`${reversalPct.toFixed(1)}%`}
            highlight="loss"
          />
        </div>

        {/* Breakdown */}
        <div className="h-px bg-border" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">condition a</p>
            <p className="text-[12px] text-foreground">{condLabel(condA)}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${totalDays > 0 ? (condAFired / totalDays) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-foreground">
                {totalDays > 0 ? ((condAFired / totalDays) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">fired {condAFired} of {totalDays} days</p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">condition b</p>
            <p className="text-[12px] text-foreground">{condLabel(condB)}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${totalDays > 0 ? (condBFired / totalDays) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-foreground">
                {totalDays > 0 ? ((condBFired / totalDays) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">fired {condBFired} of {totalDays} days</p>
          </div>
        </div>

        {/* Avg continuation size */}
        {avgContinuationSize > 0 && (
          <>
            <div className="h-px bg-border" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">avg continuation size:</span>
              <span className="text-[11px] font-semibold text-foreground">{(avgContinuationSize * 100).toFixed(1)}% of IB range</span>
            </div>
          </>
        )}
      </div>

      {/* Day-by-day detail (collapsible) */}
      <details className="rounded-xl border border-border bg-card/50">
        <summary className="px-4 py-3 text-[11px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          day-by-day breakdown ({result.details.length} days)
        </summary>
        <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 font-semibold">date</th>
                <th className="text-center py-2 font-semibold">cond A</th>
                <th className="text-center py-2 font-semibold">cond B</th>
                <th className="text-center py-2 font-semibold">both</th>
                <th className="text-center py-2 font-semibold">result</th>
              </tr>
            </thead>
            <tbody>
              {result.details.map((d) => (
                <tr key={d.date} className="border-b border-border/50">
                  <td className="py-1.5 text-foreground">{d.date}</td>
                  <td className="text-center">
                    {d.condAFired ? (
                      <span className={d.condADirection === "bullish" ? "text-profit" : "text-loss"}>
                        {d.condADirection === "bullish" ? "▲" : "▼"}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="text-center">
                    {d.condBFired ? (
                      <span className={d.condBDirection === "bullish" ? "text-profit" : "text-loss"}>
                        {d.condBDirection === "bullish" ? "▲" : "▼"}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="text-center">
                    {d.bothFired ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="text-center">
                    {d.bothFired ? (
                      d.continuation ? (
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
    <div className="rounded-lg border border-border bg-background/50 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-semibold">{label}</span>
      </div>
      <p className={`text-[18px] font-bold ${valColor}`}>{value}</p>
    </div>
  );
}
