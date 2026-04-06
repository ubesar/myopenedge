import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell } from "recharts";
import { Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Layers, Minus } from "lucide-react";
import type { ExtensionResult, ExtensionDayDetail } from "@/lib/ib-extension-analysis";
import { calcLevelsForFilter } from "@/lib/ib-extension-analysis";

type FilterTab = "all" | "breakout" | "breakdown" | "double";

interface Props {
  result: ExtensionResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

export default function ExtensionResults({ result, symbol, dateRange, weekdays }: Props) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filteredDetails = useMemo(() => {
    switch (filter) {
      case "breakout": return result.details.filter((d) => d.breakType === "single_high");
      case "breakdown": return result.details.filter((d) => d.breakType === "single_low");
      case "double": return result.details.filter((d) => d.breakType === "double");
      default: return result.details;
    }
  }, [result.details, filter]);

  const levels = useMemo(() => calcLevelsForFilter(filteredDetails), [filteredDetails]);

  const chartData = levels.map((l) => ({
    name: l.label,
    value: parseFloat(l.reachedPct.toFixed(2)),
  }));

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "all days", count: result.breakCounts.all },
    { key: "breakout", label: "breakout days", count: result.breakCounts.breakout },
    { key: "breakdown", label: "breakdown days", count: result.breakCounts.breakdown },
    { key: "double", label: "double break days", count: result.breakCounts.double },
  ];

  const ibEndTime = result.ibWindow === 30 ? "10:00 am" : "10:30 am";

  return (
    <div className="space-y-4">
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBox icon={<Calendar className="h-3.5 w-3.5" />} label="days analyzed" value={String(result.totalDays)} />
        <StatBox icon={<ArrowUpRight className="h-3.5 w-3.5" />} label="breakout" value={String(result.breakCounts.breakout)} highlight="profit" />
        <StatBox icon={<ArrowDownRight className="h-3.5 w-3.5" />} label="breakdown" value={String(result.breakCounts.breakdown)} highlight="loss" />
        <StatBox icon={<Layers className="h-3.5 w-3.5" />} label="double break" value={String(result.breakCounts.double)} />
        <StatBox icon={<Minus className="h-3.5 w-3.5" />} label="no break" value={String(result.breakCounts.noBreak)} />
      </div>

      {/* Main chart card */}
      <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6 space-y-4">
        {/* Title */}
        <div>
          <h3 className="text-[13px] font-bold text-foreground">charts</h3>
          <p className="text-[11px] text-muted-foreground">
            {symbol} {result.ibWindow}min initial balance breakout&ensp;|&ensp;by levels&ensp;|&ensp;{dateRange}&ensp;|&ensp;9:30 am - 4:00 pm
          </p>
        </div>

        {/* Chart */}
        <div className="h-[340px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--primary))" />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: number) => `${v}%`}
                  style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 justify-center">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-2 rounded-lg border text-[11px] font-medium transition-colors ${
                filter === t.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-foreground hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Custom settings */}
        <details className="border-t border-border pt-3">
          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors font-semibold text-center">
            custom settings
          </summary>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-[11px]">
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">IB timeframe:</span>
              <span className="text-foreground font-medium">9:30 am to {ibEndTime} ET</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">candle timeframe:</span>
              <span className="text-foreground font-medium">5min</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">IB breakout measure:</span>
              <span className="text-foreground font-medium">by wick</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">date range:</span>
              <span className="text-foreground font-medium">{dateRange}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">break type:</span>
              <span className="text-foreground font-medium">{filter === "all" ? "all breaks" : filter}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">weekdays to use:</span>
              <span className="text-foreground font-medium">{weekdays}</span>
            </div>
          </div>
        </details>
      </div>

      {/* Level breakdown cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {levels.map((l) => (
          <div key={l.level} className="rounded-lg border border-border bg-card p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">{l.label}x extension</p>
            <p className="text-[18px] font-bold text-foreground">{l.reachedPct.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">{l.reachedCount} / {filteredDetails.length} days</p>
          </div>
        ))}
      </div>

      {/* Day-by-day detail */}
      <details className="rounded-xl border border-border bg-card/50">
        <summary className="px-4 py-3 text-[11px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          day-by-day breakdown ({filteredDetails.length} days)
        </summary>
        <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 font-semibold">date</th>
                <th className="text-center py-2 font-semibold">break type</th>
                <th className="text-center py-2 font-semibold">max ext</th>
                <th className="text-center py-2 font-semibold">IB range</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetails.map((d) => (
                <tr key={d.date} className="border-b border-border/50">
                  <td className="py-1.5 text-foreground">{d.date}</td>
                  <td className="text-center">
                    {d.breakType === "single_high" ? (
                      <span className="text-profit">▲ breakout</span>
                    ) : d.breakType === "single_low" ? (
                      <span className="text-loss">▼ breakdown</span>
                    ) : d.breakType === "double" ? (
                      <span className="text-amber-400">⬍ double</span>
                    ) : (
                      <span className="text-muted-foreground/40">— inside</span>
                    )}
                  </td>
                  <td className="text-center font-semibold text-foreground">{d.maxExtMultiple.toFixed(2)}x</td>
                  <td className="text-center text-muted-foreground">{d.ibRange.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function StatBox({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: "profit" | "loss" }) {
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
