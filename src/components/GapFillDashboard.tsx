import { useState, useMemo } from "react";
import type { GapFillResult, GapSizeBucket, GapDayData } from "@/lib/gapfill-analysis";
import { GAP_SIZE_BUCKETS } from "@/lib/gapfill-analysis";

interface GapFillDashboardProps {
  result: GapFillResult;
  symbol: string;
  dateRange?: string;
  weekdays?: string;
}

/* ── Stacked bar (filled + not-filled) ── */
const CHART_HEIGHT = 200;

const StackedBar = ({ label, filledPct, notFilledPct }: { label: string; filledPct: number; notFilledPct: number }) => {
  const filledH = Math.max((filledPct / 100) * CHART_HEIGHT, filledPct > 0 ? 4 : 0);
  const notFilledH = Math.max((notFilledPct / 100) * CHART_HEIGHT, notFilledPct > 0 ? 4 : 0);
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: "110px" }}>
      <div className="w-full flex flex-col rounded-t-md overflow-hidden" style={{ height: `${CHART_HEIGHT}px` }}>
        {/* Not filled (top, muted) */}
        <div
          className="w-full bg-chart-grey flex items-center justify-center text-[11px] font-semibold text-muted-foreground"
          style={{ height: `${notFilledH}px` }}
        >
          {notFilledPct >= 10 && `${notFilledPct.toFixed(0)}% not filled`}
        </div>
        {/* Spacer pushes filled to bottom */}
        <div className="flex-1" />
        {/* Filled (bottom, primary) */}
        <div
          className="w-full bg-primary flex items-center justify-center text-[11px] font-semibold text-primary-foreground"
          style={{ height: `${filledH}px` }}
        >
          {filledPct >= 10 && `${filledPct.toFixed(0)}% filled`}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 lowercase">{label}</span>
    </div>
  );
};

/* ── Insights Table ── */
const InsightsTable = ({ days, label }: { days: GapDayData[]; label: string }) => {
  const total = days.length;
  const filled = days.filter((d) => d.filled).length;
  const notFilled = total - filled;
  const totalPct = 100;
  const filledPct = total > 0 ? (filled / total) * 100 : 0;
  const notFilledPct = total > 0 ? (notFilled / total) * 100 : 0;

  return (
    <div className="space-y-0.5">
      <div className="grid grid-cols-3 text-[10px] text-primary font-medium uppercase tracking-wider px-2 py-1.5 bg-muted/30 rounded-md">
        <span>category</span>
        <span className="text-center">frequency</span>
        <span className="text-right">percentage</span>
      </div>
      <Row label={label} freq={total} pct={totalPct} />
      <Row label={`${label} filled`} freq={filled} pct={filledPct} />
      <Row label={`${label} not filled`} freq={notFilled} pct={notFilledPct} />
    </div>
  );
};

const Row = ({ label, freq, pct }: { label: string; freq: number; pct: number }) => (
  <div className="grid grid-cols-3 text-[11px] text-foreground px-2 py-1.5 border-b border-border/20">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-center font-medium">{freq}</span>
    <span className="text-right font-medium">{pct.toFixed(0)}%</span>
  </div>
);

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

  // Custom range display
  const activeLabel = activeBucket === "all"
    ? "all sizes"
    : GAP_SIZE_BUCKETS.find((b) => b.key === activeBucket)?.label ?? activeBucket;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* LEFT — Charts card */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h4 className="text-[13px] font-semibold text-foreground lowercase">
            {symbol.toLowerCase()} gap fill · by size
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {dateRange && `${dateRange} · `}9:30 am – 4:00 pm · myopenedge
          </p>
        </div>

        {/* Stacked Bars */}
        <div className="px-5 py-5">
          <div className="flex items-end gap-0">
            {/* Y axis */}
            <div className="flex flex-col justify-between pr-2 text-[10px] text-muted-foreground pb-1" style={{ height: `${CHART_HEIGHT}px` }}>
              {["100%", "75%", "50%", "25%", "0%"].map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            {/* Bars */}
            <div className="flex-1 relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-b border-border/50" />
                ))}
              </div>
              <div className="relative flex items-end justify-center gap-10" style={{ height: `${CHART_HEIGHT}px` }}>
                <StackedBar label="gap up" filledPct={upFillPct} notFilledPct={100 - upFillPct} />
                <StackedBar label="gap down" filledPct={downFillPct} notFilledPct={100 - downFillPct} />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="text-muted-foreground">% filled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-chart-grey shrink-0" />
              <span className="text-muted-foreground">% not filled</span>
            </div>
          </div>
        </div>

        {/* Size filter buttons */}
        <div className="border-t border-border px-5 py-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {GAP_SIZE_BUCKETS.map((b) => (
              <button
                key={b.key}
                onClick={() => setActiveBucket(activeBucket === b.key ? "all" : b.key)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                  activeBucket === b.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            custom: <span className="text-primary font-medium">{activeLabel}</span>
          </p>
        </div>

        {/* Settings */}
        <div className="border-t border-border px-5 py-3">
          <h5 className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">fill percentage:</span>
              <span className="text-primary font-medium">100%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">measurement:</span>
              <span className="text-primary font-medium">percent</span>
            </div>
            {dateRange && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">date range:</span>
                <span className="text-primary font-medium">{dateRange}</span>
              </div>
            )}
            {weekdays && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">weekdays:</span>
                <span className="text-primary font-medium">{weekdays}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — Insights card */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h4 className="text-[13px] font-semibold text-foreground lowercase">insights</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {symbol.toLowerCase()} gap fill · by size · myopenedge
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          <InsightsTable days={gapUpDays} label="gap up" />
          <InsightsTable days={gapDownDays} label="gap down" />

          {/* Day of week breakdown */}
          <div className="space-y-0.5">
            <div className="grid grid-cols-3 text-[10px] text-primary font-medium uppercase tracking-wider px-2 py-1.5 bg-muted/30 rounded-md">
              <span>day</span>
              <span className="text-center">gaps</span>
              <span className="text-right">fill rate</span>
            </div>
            {result.stats.byDayOfWeek.map((d) => (
              <div key={d.day} className="grid grid-cols-3 text-[11px] text-foreground px-2 py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">{d.day}</span>
                <span className="text-center font-medium">{d.total}</span>
                <span className="text-right font-medium">{d.rate.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GapFillDashboard;
