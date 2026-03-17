import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { GapFillResult, GapSizeBucket, GapDayData } from "@/lib/gapfill-analysis";
import { GAP_SIZE_BUCKETS } from "@/lib/gapfill-analysis";

interface GapFillDashboardProps {
  result: GapFillResult;
  symbol: string;
  dateRange?: string;
  weekdays?: string;
}

/* ── Helpers ── */
const FILLED_COLOR = "hsl(217, 91%, 60%)";
const NOT_FILLED_COLOR = "hsl(240, 10%, 18%)";

/* ── Custom label inside bar ── */
const InsideLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value || height < 20) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="hsl(0, 0%, 100%)"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={600}
    >
      {value.toFixed(0)}%
    </text>
  );
};

/* ── Insights Table Row ── */
const InsightRow = ({
  label,
  freq,
  pct,
  highlight,
}: {
  label: string;
  freq: number;
  pct: number;
  highlight?: boolean;
}) => (
  <div
    className={`grid grid-cols-3 text-[11px] px-3 py-2 border-b border-border/30 ${
      highlight ? "text-foreground font-semibold" : "text-muted-foreground"
    }`}
  >
    <span className="lowercase">{label}</span>
    <span className="text-center font-medium text-foreground">{freq}</span>
    <span className="text-right font-medium text-foreground">{pct.toFixed(1)}%</span>
  </div>
);

/* ── Main Component ── */
const GapFillDashboard = ({ result, symbol, dateRange, weekdays }: GapFillDashboardProps) => {
  const [activeBucket, setActiveBucket] = useState<GapSizeBucket | "all">("all");

  const filtered = useMemo(() => {
    if (activeBucket === "all") return result.allDays;
    return result.allDays.filter((d) => d.sizeBucket === activeBucket);
  }, [result.allDays, activeBucket]);

  const gapUpDays = useMemo(() => filtered.filter((d) => d.direction === "up"), [filtered]);
  const gapDownDays = useMemo(() => filtered.filter((d) => d.direction === "down"), [filtered]);

  const upFilled = gapUpDays.filter((d) => d.filled).length;
  const downFilled = gapDownDays.filter((d) => d.filled).length;
  const upFillPct = gapUpDays.length > 0 ? (upFilled / gapUpDays.length) * 100 : 0;
  const downFillPct = gapDownDays.length > 0 ? (downFilled / gapDownDays.length) * 100 : 0;
  const upNotPct = 100 - upFillPct;
  const downNotPct = 100 - downFillPct;

  const chartData = [
    { name: "Gap Up", filled: upFillPct, notFilled: upNotPct },
    { name: "Gap Down", filled: downFillPct, notFilled: downNotPct },
  ];

  const activeLabel =
    activeBucket === "all"
      ? "all sizes"
      : GAP_SIZE_BUCKETS.find((b) => b.key === activeBucket)?.label ?? activeBucket;

  /* ── Insights data ── */
  const upNotFilled = gapUpDays.length - upFilled;
  const downNotFilled = gapDownDays.length - downFilled;
  const totalGaps = gapUpDays.length + gapDownDays.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr_1fr] gap-0 border border-border rounded-2xl bg-card overflow-hidden min-h-[520px]">
      {/* ═══ LEFT — Settings / Controls ═══ */}
      <div className="border-r border-border p-5 flex flex-col gap-5">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground lowercase mb-0.5">
            gap fill by size
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {symbol.toLowerCase()} · myopenedge
          </p>
        </div>

        {/* Settings grid */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              asset & ticker
            </label>
            <div className="bg-secondary rounded-lg px-3 py-2 text-[12px] text-foreground font-medium lowercase">
              {symbol.toLowerCase()}
            </div>
          </div>

          {dateRange && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                date range
              </label>
              <div className="bg-secondary rounded-lg px-3 py-2 text-[12px] text-foreground font-medium lowercase">
                {dateRange}
              </div>
            </div>
          )}

          {weekdays && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                weekdays
              </label>
              <div className="bg-secondary rounded-lg px-3 py-2 text-[12px] text-foreground font-medium lowercase">
                {weekdays}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              active filter
            </label>
            <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-[12px] text-primary font-semibold lowercase">
              {activeLabel}
            </div>
          </div>
        </div>

        {/* Day-of-week mini stats */}
        <div className="mt-auto space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            fill rate by day
          </span>
          {result.stats.byDayOfWeek.map((d) => (
            <div
              key={d.day}
              className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-secondary/50"
            >
              <span className="text-muted-foreground lowercase">{d.day}</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground/50 text-[10px]">{d.total} gaps</span>
                <span className="text-foreground font-semibold">{d.rate.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CENTER — Chart + Bucket Filters ═══ */}
      <div className="border-r border-border flex flex-col">
        {/* Chart header */}
        <div className="px-5 pt-5 pb-3">
          <h4 className="text-[12px] font-semibold text-foreground lowercase">
            filled vs not filled
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            stacked comparison · {activeLabel}
          </p>
        </div>

        {/* Recharts stacked bar */}
        <div className="flex-1 min-h-[300px] px-4 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap="30%"
              barGap={8}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(240, 10%, 14%)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(240, 5%, 40%)", fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(240, 5%, 40%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: "hsl(240, 10%, 10%)" }}
                contentStyle={{
                  backgroundColor: "hsl(240, 14%, 8%)",
                  border: "1px solid hsl(240, 10%, 14%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "hsl(240, 5%, 90%)",
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === "filled" ? "% Filled" : "% Not Filled",
                ]}
              />
              <Bar
                dataKey="filled"
                stackId="stack"
                fill={FILLED_COLOR}
                radius={[0, 0, 0, 0]}
              >
                <LabelList dataKey="filled" content={<InsideLabel />} />
              </Bar>
              <Bar
                dataKey="notFilled"
                stackId="stack"
                fill={NOT_FILLED_COLOR}
                radius={[6, 6, 0, 0]}
              >
                <LabelList dataKey="notFilled" content={<InsideLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 px-5 pb-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary shrink-0" />
            <span className="text-muted-foreground">% filled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: NOT_FILLED_COLOR }} />
            <span className="text-muted-foreground">% not filled</span>
          </div>
        </div>

        {/* Gap size category buttons */}
        <div className="border-t border-border px-5 py-4">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-2.5">
            gap size category
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveBucket("all")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                activeBucket === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_hsl(217,91%,60%,0.3)]"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              all sizes
            </button>
            {GAP_SIZE_BUCKETS.map((b) => (
              <button
                key={b.key}
                onClick={() => setActiveBucket(b.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                  activeBucket === b.key
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_hsl(217,91%,60%,0.3)]"
                    : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT — Insights Table ═══ */}
      <div className="flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h4 className="text-[12px] font-semibold text-foreground lowercase">insights</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            frequency & percentage · {activeLabel}
          </p>
        </div>

        <div className="flex-1 px-0 py-3 space-y-4 overflow-y-auto">
          {/* Gap Up section */}
          <div>
            <div className="grid grid-cols-3 text-[9px] text-primary font-semibold uppercase tracking-widest px-3 py-2 bg-primary/5 mx-3 rounded-md">
              <span>category</span>
              <span className="text-center">frequency</span>
              <span className="text-right">percentage</span>
            </div>
            <div className="mx-3 mt-1">
              <InsightRow
                label="gap up"
                freq={gapUpDays.length}
                pct={totalGaps > 0 ? (gapUpDays.length / totalGaps) * 100 : 0}
                highlight
              />
              <InsightRow
                label="gap up filled"
                freq={upFilled}
                pct={gapUpDays.length > 0 ? upFillPct : 0}
              />
              <InsightRow
                label="gap up not filled"
                freq={upNotFilled}
                pct={gapUpDays.length > 0 ? upNotPct : 0}
              />
            </div>
          </div>

          {/* Gap Down section */}
          <div>
            <div className="grid grid-cols-3 text-[9px] text-primary font-semibold uppercase tracking-widest px-3 py-2 bg-primary/5 mx-3 rounded-md">
              <span>category</span>
              <span className="text-center">frequency</span>
              <span className="text-right">percentage</span>
            </div>
            <div className="mx-3 mt-1">
              <InsightRow
                label="gap down"
                freq={gapDownDays.length}
                pct={totalGaps > 0 ? (gapDownDays.length / totalGaps) * 100 : 0}
                highlight
              />
              <InsightRow
                label="gap down filled"
                freq={downFilled}
                pct={gapDownDays.length > 0 ? downFillPct : 0}
              />
              <InsightRow
                label="gap down not filled"
                freq={downNotFilled}
                pct={gapDownDays.length > 0 ? downNotPct : 0}
              />
            </div>
          </div>

          {/* Summary stats */}
          <div className="mx-3 mt-2 space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block">
              summary
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <div className="text-[18px] font-bold text-primary">
                  {result.stats.overallFillRate.toFixed(0)}%
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  overall fill rate
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <div className="text-[18px] font-bold text-foreground">
                  {totalGaps}
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  total gaps
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <div className="text-[16px] font-bold text-foreground">
                  {upFillPct.toFixed(0)}%
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  gap up fill
                </div>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <div className="text-[16px] font-bold text-foreground">
                  {downFillPct.toFixed(0)}%
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  gap down fill
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GapFillDashboard;
