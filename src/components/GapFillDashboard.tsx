import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell } from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, TrendingUp, Calendar, Layers } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { GapFillResult, GapSize } from "@/lib/gapfill-analysis";

interface GapFillDashboardProps {
  result: GapFillResult;
  symbol: string;
}

const SIZE_LABELS: Record<GapSize, string> = {
  small: "Small (0–0.5%)",
  medium: "Medium (0.5–1%)",
  large: "Large (>1%)",
};

const GapFillDashboard = ({ result, symbol }: GapFillDashboardProps) => {
  const { stats } = result;
  const [sizeFilter, setSizeFilter] = useState<GapSize | "all">("all");

  // Filtered stats by size
  const filteredDays =
    sizeFilter === "all"
      ? result.allDays
      : result.allDays.filter((d) => d.gapSize === sizeFilter);

  const filteredGapUp = filteredDays.filter((d) => d.direction === "up");
  const filteredGapDown = filteredDays.filter((d) => d.direction === "down");
  const filteredUpFill = filteredGapUp.filter((d) => d.filled).length;
  const filteredDownFill = filteredGapDown.filter((d) => d.filled).length;
  const filteredUpRate = filteredGapUp.length > 0 ? (filteredUpFill / filteredGapUp.length) * 100 : 0;
  const filteredDownRate = filteredGapDown.length > 0 ? (filteredDownFill / filteredGapDown.length) * 100 : 0;
  const filteredOverall = filteredDays.length > 0
    ? (filteredDays.filter((d) => d.filled).length / filteredDays.length) * 100
    : 0;

  // Bar chart data
  const barData = [
    { name: "Gap Up Fill", value: parseFloat(filteredUpRate.toFixed(1)), type: "up" },
    { name: "Gap Down Fill", value: parseFloat(filteredDownRate.toFixed(1)), type: "down" },
  ];

  // By size chart data
  const sizeData = (["small", "medium", "large"] as GapSize[]).map((s) => ({
    name: SIZE_LABELS[s],
    short: s.charAt(0).toUpperCase() + s.slice(1),
    rate: parseFloat(stats.bySize[s].rate.toFixed(1)),
    total: stats.bySize[s].total,
    filled: stats.bySize[s].filled,
  }));

  // Heatmap color
  const heatColor = (rate: number) => {
    if (rate >= 80) return "bg-emerald-500/30 text-emerald-300";
    if (rate >= 60) return "bg-emerald-500/15 text-emerald-400";
    if (rate >= 40) return "bg-yellow-500/15 text-yellow-400";
    if (rate >= 20) return "bg-orange-500/15 text-orange-400";
    return "bg-red-500/15 text-red-400";
  };

  const cs = stats.currentSession;

  return (
    <div className="space-y-3">
      {/* Current Session Status */}
      {cs && cs.hasGap && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 backdrop-blur-md p-3 sm:p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">
              Current Session — {symbol}
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {cs.direction === "up" ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-red-400" />
              )}
              <span className="text-sm font-medium text-card-foreground">
                Gap {cs.direction === "up" ? "Up" : "Down"}{" "}
                <span className="text-muted-foreground">
                  ({Math.abs(cs.gapPercent).toFixed(2)}% · {cs.gapSize})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Historical Fill Probability:{" "}
                <span className="font-bold text-primary">
                  {cs.historicalFillRate.toFixed(1)}%
                </span>
              </span>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-semibold ${cs.filled ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"}`}>
              {cs.filled ? "✅ Filled" : "⏳ Not Filled Yet"}
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall Fill Rate</p>
          <p className="text-2xl font-bold text-primary mt-1">{filteredOverall.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">{filteredDays.length} gaps</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gap Up Fill</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{filteredUpRate.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">{filteredUpFill}/{filteredGapUp.length}</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gap Down Fill</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{filteredDownRate.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">{filteredDownFill}/{filteredGapDown.length}</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Days</p>
          <p className="text-2xl font-bold text-card-foreground mt-1">{result.totalDays}</p>
          <p className="text-[10px] text-muted-foreground">analyzed</p>
        </div>
      </div>

      {/* Gap Size Filter */}
      <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Filter by Gap Size</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "small", "medium", "large"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSizeFilter(s)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                sizeFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "all" ? "All Sizes" : SIZE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gap Up vs Down Fill Bar Chart */}
        <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 sm:p-4 shadow-lg sm:aspect-square flex flex-col">
          <h3 className="text-sm font-semibold text-card-foreground mb-1">Gap Up vs Down Fill %</h3>
          <p className="text-xs text-muted-foreground mb-2">{filteredDays.length} gap days</p>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(0,0%,55%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(0,0%,20%)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "hsl(0,0%,55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
                  {barData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.type === "up" ? "hsl(142,71%,45%)" : "hsl(0,84%,60%)"}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v: number) => `${v}%`}
                    style={{ fill: "hsl(0,0%,85%)", fontSize: 13, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fill Rate by Gap Size */}
        <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 sm:p-4 shadow-lg sm:aspect-square flex flex-col">
          <h3 className="text-sm font-semibold text-card-foreground mb-1">Fill Rate by Gap Size</h3>
          <p className="text-xs text-muted-foreground mb-2">probability varies with gap magnitude</p>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
                <XAxis
                  dataKey="short"
                  tick={{ fill: "hsl(0,0%,55%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(0,0%,20%)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "hsl(0,0%,55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={80} fill="hsl(213,94%,56%)">
                  <LabelList
                    dataKey="rate"
                    position="top"
                    formatter={(v: number) => `${v}%`}
                    style={{ fill: "hsl(0,0%,85%)", fontSize: 13, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Day of Week Heatmap */}
      <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 sm:p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Fill Probability by Day of Week</h3>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {stats.byDayOfWeek.map((d) => (
            <div
              key={d.day}
              className={`rounded-lg p-3 text-center ${heatColor(d.rate)}`}
            >
              <p className="text-xs font-semibold mb-1">{d.day}</p>
              <p className="text-lg font-bold">{d.rate.toFixed(0)}%</p>
              <p className="text-[10px] opacity-70">
                {d.filled}/{d.total}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg">
        <h3 className="text-xs sm:text-sm font-semibold text-card-foreground mb-1">
          📋 Gap Fill Insights — {symbol}
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className={`flex-1 rounded-md border px-3 py-1.5 ${stats.gapUpFillRate >= 50 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
            <span className={`text-[10px] font-bold uppercase ${stats.gapUpFillRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
              Gap Up → {stats.gapUpFillRate >= 50 ? "Likely Fills" : "Often Holds"}
            </span>
            <p className="text-xs text-card-foreground mt-0.5">
              {stats.gapUpFillRate.toFixed(1)}% of gap ups filled ({stats.filledGapUp}/{stats.totalGapUp} days). 
              {stats.gapUpFillRate >= 60 ? " Fade gap-up openings." : " Trend may continue higher."}
            </p>
          </div>
          <div className={`flex-1 rounded-md border px-3 py-1.5 ${stats.gapDownFillRate >= 50 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
            <span className={`text-[10px] font-bold uppercase ${stats.gapDownFillRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
              Gap Down → {stats.gapDownFillRate >= 50 ? "Likely Fills" : "Often Holds"}
            </span>
            <p className="text-xs text-card-foreground mt-0.5">
              {stats.gapDownFillRate.toFixed(1)}% of gap downs filled ({stats.filledGapDown}/{stats.totalGapDown} days).
              {stats.gapDownFillRate >= 60 ? " Buy the dip on gap-down opens." : " Weakness may persist."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GapFillDashboard;
