import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, CalendarDays, ArrowUpDown } from "lucide-react";
import type { NYGapM15Result, NYGapM15Day, GapCategory } from "@/lib/nygap-m15-analysis";
import { GAP_CATEGORIES } from "@/lib/nygap-m15-analysis";

interface Props {
  result: NYGapM15Result;
  symbol: string;
}

const BULLISH_COLOR = "hsl(160, 84%, 39%)";
const BEARISH_COLOR = "hsl(0, 84%, 60%)";

function DonutChart({ title, bullish, bearish, bullishPct, bearishPct, total }: {
  title: string;
  bullish: number;
  bearish: number;
  bullishPct: number;
  bearishPct: number;
  total: number;
}) {
  const data = [
    { name: "Bullish", value: bullish, pct: bullishPct },
    { name: "Bearish", value: bearish, pct: bearishPct },
  ];

  if (total === 0) {
    return (
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32 px-3">
          <p className="text-xs text-muted-foreground">No data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/60 border-border/30">
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <p className="text-[10px] text-muted-foreground">{total} days</p>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={40}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={BULLISH_COLOR} />
                  <Cell fill={BEARISH_COLOR} />
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} days`, name]}
                  contentStyle={{ background: "hsl(220, 18%, 9%)", border: "1px solid hsl(220, 14%, 16%)", borderRadius: "8px", fontSize: "11px" }}
                  itemStyle={{ color: "hsl(210, 20%, 92%)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: BULLISH_COLOR }} />
              <span className="text-muted-foreground">Bullish</span>
              <span className="font-semibold text-foreground ml-auto">{bullishPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: BEARISH_COLOR }} />
              <span className="text-muted-foreground">Bearish</span>
              <span className="font-semibold text-foreground ml-auto">{bearishPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function computeStats(days: NYGapM15Day[]) {
  const gapUps = days.filter((d) => d.gapType === "Gap Up");
  const gapDowns = days.filter((d) => d.gapType === "Gap Down");
  const guBullish = gapUps.filter((d) => d.m15Direction === "Bullish").length;
  const guBearish = gapUps.filter((d) => d.m15Direction === "Bearish").length;
  const gdBullish = gapDowns.filter((d) => d.m15Direction === "Bullish").length;
  const gdBearish = gapDowns.filter((d) => d.m15Direction === "Bearish").length;

  return {
    totalDays: days.length,
    gapUpDays: gapUps.length,
    gapDownDays: gapDowns.length,
    gapUp: {
      bullish: guBullish,
      bearish: guBearish,
      bullishPct: gapUps.length > 0 ? (guBullish / gapUps.length) * 100 : 0,
      bearishPct: gapUps.length > 0 ? (guBearish / gapUps.length) * 100 : 0,
    },
    gapDown: {
      bullish: gdBullish,
      bearish: gdBearish,
      bullishPct: gapDowns.length > 0 ? (gdBullish / gapDowns.length) * 100 : 0,
      bearishPct: gapDowns.length > 0 ? (gdBearish / gapDowns.length) * 100 : 0,
    },
  };
}

type SortKey = "date" | "gapType" | "gapSize" | "gapCategory" | "m15Direction";
type SortDir = "asc" | "desc";

const NYGapM15Dashboard = ({ result, symbol }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState<GapCategory | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filteredDays = useMemo(() => {
    if (selectedCategory === "all") return result.allDays;
    return result.allDays.filter((d) => d.gapCategory === selectedCategory);
  }, [result.allDays, selectedCategory]);

  const stats = useMemo(() => computeStats(filteredDays), [filteredDays]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedDays = useMemo(() => {
    const sorted = [...filteredDays];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "gapType": cmp = a.gapType.localeCompare(b.gapType); break;
        case "gapSize": cmp = a.gapSize - b.gapSize; break;
        case "gapCategory": cmp = a.gapCategory.localeCompare(b.gapCategory); break;
        case "m15Direction": cmp = a.m15Direction.localeCompare(b.m15Direction); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredDays, sortKey, sortDir]);

  // Day of week stats from filtered data
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDayOfWeek = useMemo(() => {
    return [1, 2, 3, 4, 5].map((dow) => {
      const subset = filteredDays.filter((d) => d.dayOfWeek === dow);
      return {
        day: DAY_NAMES[dow],
        bullish: subset.filter((d) => d.m15Direction === "Bullish").length,
        bearish: subset.filter((d) => d.m15Direction === "Bearish").length,
      };
    });
  }, [filteredDays]);

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
      onClick={() => toggleSort(k)}
    >
      <span className="flex items-center gap-0.5">
        {label}
        {sortKey === k && <ArrowUpDown className="h-2.5 w-2.5" />}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Gap Size % Filter */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">Gap Size (%) Filter</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-2 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              All
            </button>
            {GAP_CATEGORIES.map((cat) => {
              const count = result.allDays.filter((d) => d.gapCategory === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-1.5 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <span className="block">{cat}</span>
                  <span className="block text-[8px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-card/60 border-border/30">
          <CardContent className="p-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Total Days</p>
              <p className="text-lg font-bold text-foreground">{stats.totalDays}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="p-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-profit" />
            <div>
              <p className="text-[10px] text-muted-foreground">Gap Up Days</p>
              <p className="text-lg font-bold text-foreground">{stats.gapUpDays}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="p-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-loss" />
            <div>
              <p className="text-[10px] text-muted-foreground">Gap Down Days</p>
              <p className="text-lg font-bold text-foreground">{stats.gapDownDays}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Donut Charts */}
      <div className="grid grid-cols-2 gap-2">
        <DonutChart
          title="If Gap Up → M15 Direction"
          bullish={stats.gapUp.bullish}
          bearish={stats.gapUp.bearish}
          bullishPct={stats.gapUp.bullishPct}
          bearishPct={stats.gapUp.bearishPct}
          total={stats.gapUpDays}
        />
        <DonutChart
          title="If Gap Down → M15 Direction"
          bullish={stats.gapDown.bullish}
          bearish={stats.gapDown.bearish}
          bullishPct={stats.gapDown.bullishPct}
          bearishPct={stats.gapDown.bearishPct}
          total={stats.gapDownDays}
        />
      </div>

      {/* Day of Week Stats */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">M15 Direction by Day of Week</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-5 gap-1.5">
            {byDayOfWeek.map((d) => {
              const total = d.bullish + d.bearish;
              const bullPct = total > 0 ? (d.bullish / total) * 100 : 0;
              return (
                <div key={d.day} className="text-center p-1.5 rounded bg-muted/50">
                  <p className="text-[10px] font-medium text-muted-foreground">{d.day}</p>
                  <p className="text-xs font-bold text-foreground">{total}</p>
                  {total > 0 && (
                    <div className="mt-1 h-1 rounded-full overflow-hidden bg-loss/30">
                      <div className="h-full rounded-full bg-profit" style={{ width: `${bullPct}%` }} />
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {total > 0 ? `${bullPct.toFixed(0)}% Bull` : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historical Data Table */}
      <Card className="bg-card/60 border-border/30">
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Historical Log — {symbol}
            {selectedCategory !== "all" && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px]">
                {selectedCategory}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border/30">
                  <SortHeader label="Date" k="date" />
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-muted-foreground">Prev Close</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-muted-foreground">NY Open</th>
                  <SortHeader label="Gap Type" k="gapType" />
                  <SortHeader label="Gap %" k="gapSize" />
                  <SortHeader label="Category" k="gapCategory" />
                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-muted-foreground">M15 Close</th>
                  <SortHeader label="M15 Dir" k="m15Direction" />
                </tr>
              </thead>
              <tbody>
                {sortedDays.map((d) => (
                  <tr key={d.date} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-1 text-foreground">{d.date}</td>
                    <td className="px-2 py-1 text-right text-foreground">{d.prevClose.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right text-foreground">{d.nyOpen.toFixed(2)}</td>
                    <td className="px-2 py-1">
                      <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                        d.gapType === "Gap Up"
                          ? "bg-profit/15 text-profit"
                          : "bg-loss/15 text-loss"
                      }`}>
                        {d.gapType}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right text-foreground">{Math.abs(d.gapPercent).toFixed(2)}%</td>
                    <td className="px-2 py-1">
                      <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">
                        {d.gapCategory}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right text-foreground">{d.m15Close.toFixed(2)}</td>
                    <td className="px-2 py-1">
                      <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                        d.m15Direction === "Bullish"
                          ? "bg-profit/15 text-profit"
                          : "bg-loss/15 text-loss"
                      }`}>
                        {d.m15Direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NYGapM15Dashboard;
