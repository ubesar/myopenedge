import { useState, useMemo } from "react";
import type { GapFillResult, GapSizeBucket, GapDayData } from "@/lib/gapfill-analysis";
import { GAP_SIZE_BUCKETS } from "@/lib/gapfill-analysis";

interface GapFillDashboardProps {
  result: GapFillResult;
  symbol: string;
  dateRange?: string;
  weekdays?: string;
}

const FILLED_COLOR_VAR = "hsl(var(--chart-bar-a))";
const NOT_FILLED_COLOR_VAR = "hsl(var(--chart-bar-b))";
const BAR_HEIGHT = 340;

/* ── Stacked Bar ── */
const StackedBar = ({
  label,
  filledPct,
  notFilledPct,
}: {
  label: string;
  filledPct: number;
  notFilledPct: number;
}) => {
  const filledH = Math.max((filledPct / 100) * BAR_HEIGHT, filledPct > 0 ? 6 : 0);
  const notFilledH = Math.max((notFilledPct / 100) * BAR_HEIGHT, notFilledPct > 0 ? 6 : 0);

  return (
    <div className="flex flex-col items-center gap-2" style={{ width: 140 }}>
      <div
        className="w-full flex flex-col rounded-t-md overflow-hidden"
        style={{ height: BAR_HEIGHT }}
      >
        {/* Not filled (top) */}
        <div
          className="w-full flex items-center justify-center text-[12px] font-semibold"
          style={{
            height: notFilledH,
            backgroundColor: NOT_FILLED_COLOR_VAR,
            color: "hsl(0, 0%, 100%)",
          }}
        >
          {notFilledPct >= 4 && `${notFilledPct.toFixed(0)}% not filled`}
        </div>
        {/* Spacer */}
        <div className="flex-1" />
        {/* Filled (bottom) */}
        <div
          className="w-full flex items-center justify-center text-[13px] font-bold text-primary-foreground"
          style={{
            height: filledH,
            backgroundColor: FILLED_COLOR_VAR,
          }}
        >
          {filledPct >= 4 && `${filledPct.toFixed(0)}% filled`}
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground lowercase">{label}</span>
    </div>
  );
};

/* ── Main ── */
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

  const totalGaps = gapUpDays.length + gapDownDays.length;
  const upNotFilled = gapUpDays.length - upFilled;
  const downNotFilled = gapDownDays.length - downFilled;

  const activeLabel =
    activeBucket === "all"
      ? "all sizes"
      : GAP_SIZE_BUCKETS.find((b) => b.key === activeBucket)?.label ?? activeBucket;

  // Determine which direction + bucket is active for the top summary
  const dominantDir = upFillPct >= downFillPct ? "up" : "down";
  const dominantPct = Math.max(upFillPct, downFillPct);

  return (
    <div className="space-y-4">
      {/* ═══ TOP SUMMARY BAR ═══ */}
      <div className="border border-border rounded-xl bg-card px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Symbol */}
        <div className="flex items-center gap-3">
          <span className="text-[18px] font-bold text-foreground uppercase tracking-wide">
            {symbol}
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground lowercase">gap fill by size</span>
            <span className="text-[10px] text-primary font-medium">myopenedge</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border hidden sm:block" />

        {/* Gap type info */}
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground block lowercase">
            gap {dominantDir} between
          </span>
          <span className="text-[12px] text-foreground font-semibold lowercase">{activeLabel}</span>
          <span className="text-[10px] text-muted-foreground block">gap type</span>
        </div>

        {/* Fill rate highlight */}
        <div className="bg-profit/10 border border-profit/30 rounded-lg px-4 py-2 text-center">
          <span className="text-[22px] font-black text-profit">{dominantPct.toFixed(0)}%</span>
          <span className="text-[10px] text-muted-foreground block">gap fill</span>
        </div>

        {/* Date range */}
        {dateRange && (
          <>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div className="text-center">
              <span className="text-[12px] text-foreground font-medium lowercase">{dateRange}</span>
              <span className="text-[10px] text-muted-foreground block">date range</span>
            </div>
          </>
        )}

        {weekdays && (
          <div className="text-center">
            <span className="text-[12px] text-foreground font-medium lowercase">{weekdays}</span>
            <span className="text-[10px] text-muted-foreground block">weekdays</span>
          </div>
        )}
      </div>

      {/* ═══ MAIN 2-PANEL: CHARTS + INSIGHTS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* ── LEFT: Charts ── */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <h4 className="text-[13px] font-semibold text-foreground lowercase">charts</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {symbol.toLowerCase()} gap fill&nbsp;&nbsp;|&nbsp;&nbsp;by size
              {dateRange && <>&nbsp;&nbsp;|&nbsp;&nbsp;{dateRange}</>}
              &nbsp;&nbsp;|&nbsp;&nbsp;9:30 am – 4:00 pm&nbsp;&nbsp;|&nbsp;&nbsp;
              <span className="text-primary font-medium">myopenedge</span>
            </p>
          </div>

          {/* Chart area */}
          <div className="px-5 py-6">
            <div className="flex items-end gap-0">
              {/* Y-axis labels */}
              <div
                className="flex flex-col justify-between pr-3 text-[11px] text-muted-foreground"
                style={{ height: BAR_HEIGHT }}
              >
                {["100%", "75%", "50%", "25%", "0%"].map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>

              {/* Bars */}
              <div className="flex-1 relative">
                {/* Grid lines */}
                <div
                  className="absolute inset-0 flex flex-col justify-between pointer-events-none"
                  style={{ height: BAR_HEIGHT }}
                >
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="border-b border-border/40" />
                  ))}
                </div>
                {/* Stacked bars */}
                <div
                  className="relative flex items-end justify-center gap-16"
                  style={{ height: BAR_HEIGHT }}
                >
                  <StackedBar label="gap up" filledPct={upFillPct} notFilledPct={upNotPct} />
                  <StackedBar label="gap down" filledPct={downFillPct} notFilledPct={downNotPct} />
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                <span className="text-muted-foreground">% filled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: NOT_FILLED_COLOR }}
                />
                <span className="text-muted-foreground">% not filled</span>
              </div>
            </div>
          </div>

          {/* Gap size bucket buttons */}
          <div className="border-t border-border px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {GAP_SIZE_BUCKETS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setActiveBucket(activeBucket === b.key ? "all" : b.key)}
                  className={`px-3.5 py-2 rounded-full text-[11px] font-medium border transition-all duration-200 ${
                    activeBucket === b.key
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_hsl(217,91%,60%,0.25)]"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              custom: <span className="text-primary font-medium">{activeLabel}</span>
            </p>
          </div>
        </div>

        {/* ── RIGHT: Insights ── */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <h4 className="text-[13px] font-semibold text-foreground lowercase">insights</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {symbol.toLowerCase()} gap fill&nbsp;&nbsp;|&nbsp;&nbsp;by size&nbsp;&nbsp;|&nbsp;&nbsp;
              <span className="text-primary font-medium">myopenedge</span>
            </p>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* Gap Up table */}
            <div>
              <div className="grid grid-cols-3 text-[10px] text-muted-foreground font-medium lowercase tracking-wider px-2 py-2 bg-muted/20 rounded-md">
                <span>category</span>
                <span className="text-center">frequency</span>
                <span className="text-right">percentage</span>
              </div>
              <InsightRow label="gap up" freq={gapUpDays.length} pct={totalGaps > 0 ? (gapUpDays.length / totalGaps) * 100 : 0} bold />
              <InsightRow label="gap up filled" freq={upFilled} pct={upFillPct} />
              <InsightRow label="gap up not filled" freq={upNotFilled} pct={upNotPct} />
            </div>

            {/* Gap Down table */}
            <div>
              <div className="grid grid-cols-3 text-[10px] text-muted-foreground font-medium lowercase tracking-wider px-2 py-2 bg-muted/20 rounded-md">
                <span>category</span>
                <span className="text-center">frequency</span>
                <span className="text-right">percentage</span>
              </div>
              <InsightRow label="gap down" freq={gapDownDays.length} pct={totalGaps > 0 ? (gapDownDays.length / totalGaps) * 100 : 0} bold />
              <InsightRow label="gap down filled" freq={downFilled} pct={downFillPct} />
              <InsightRow label="gap down not filled" freq={downNotFilled} pct={downNotPct} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Table row ── */
const InsightRow = ({ label, freq, pct, bold }: { label: string; freq: number; pct: number; bold?: boolean }) => (
  <div className={`grid grid-cols-3 text-[12px] px-2 py-2.5 border-b border-border/20 ${bold ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
    <span className="lowercase">{label}</span>
    <span className="text-center font-medium text-foreground">{freq}</span>
    <span className="text-right font-semibold text-foreground">{pct.toFixed(0)}%</span>
  </div>
);

export default GapFillDashboard;
