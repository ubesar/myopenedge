import type { OCCResult, OCCCandleSize } from "@/lib/occ-analysis";

interface OCCDashboardProps {
  result: OCCResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
  candleSize: OCCCandleSize;
  onCandleSizeChange: (size: OCCCandleSize) => void;
}

const CHART_HEIGHT = 280;
const BAR_WIDTH = 120;

const CANDLE_SIZES: { value: OCCCandleSize; label: string }[] = [
  { value: "5m", label: "5min" },
  { value: "15m", label: "15min" },
  { value: "30m", label: "30min" },
  { value: "1h", label: "1hour" },
];

const OCCDashboard = ({ result, symbol, dateRange, weekdays, candleSize, onCandleSizeChange }: OCCDashboardProps) => {
  const { greenCandle, redCandle } = result;

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-[13px] font-semibold text-foreground lowercase">
              {symbol.toLowerCase()} opening candle continuation
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              opening candle size: {candleSize} · 09:30 am – 04:00 pm · {dateRange}
            </p>
          </div>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            {result.totalDays} days
          </span>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <div className="px-5 py-6">
        <div className="flex items-end gap-0">
          {/* Y axis */}
          <div
            className="flex flex-col justify-between pr-3 text-[10px] text-muted-foreground pb-1"
            style={{ height: `${CHART_HEIGHT}px` }}
          >
            {["100%", "75%", "50%", "25%", "0%"].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>

          {/* Bars area */}
          <div className="flex-1 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-b border-border/40" />
              ))}
            </div>

            {/* Stacked bars */}
            <div
              className="relative flex items-end justify-center gap-12 sm:gap-20"
              style={{ height: `${CHART_HEIGHT}px` }}
            >
              <StackedBar
                label="green candle"
                greenPct={greenCandle.greenDayPct}
                redPct={greenCandle.redDayPct}
              />
              <StackedBar
                label="red candle"
                greenPct={redCandle.greenDayPct}
                redPct={redCandle.redDayPct}
              />
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex items-start justify-center gap-12 sm:gap-20 ml-8 mt-3">
          <span className="text-[11px] text-muted-foreground text-center" style={{ width: `${BAR_WIDTH}px` }}>
            green candle
          </span>
          <span className="text-[11px] text-muted-foreground text-center" style={{ width: `${BAR_WIDTH}px` }}>
            red candle
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-8 mt-5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-primary" />
            <span className="text-muted-foreground">% green day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-chart-grey" />
            <span className="text-muted-foreground">% red day</span>
          </div>
        </div>
      </div>

      {/* Custom Settings */}
      <div className="border-t border-border px-5 py-3">
        <h5 className="text-[11px] text-muted-foreground mb-3 uppercase tracking-wider">custom settings</h5>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">opening candle size:</span>
            <span className="text-primary font-semibold">{candleSize}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">session:</span>
            <span className="text-primary font-semibold">09:30 – 16:00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">date range:</span>
            <span className="text-primary font-semibold">{dateRange}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">weekdays:</span>
            <span className="text-primary font-semibold">{weekdays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">green candle days:</span>
            <span className="text-primary font-semibold">{greenCandle.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">red candle days:</span>
            <span className="text-primary font-semibold">{redCandle.total}</span>
          </div>
        </div>

        {/* Candle size selector */}
        <div className="mt-3 pt-3 border-t border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">change candle size</span>
          <div className="flex gap-1.5 mt-1.5">
            {CANDLE_SIZES.map((cs) => (
              <button
                key={cs.value}
                onClick={() => onCandleSizeChange(cs.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  candleSize === cs.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cs.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Stacked Bar Sub-component ─── */
function StackedBar({
  label,
  greenPct,
  redPct,
}: {
  label: string;
  greenPct: number;
  redPct: number;
}) {
  const totalHeight = CHART_HEIGHT;
  const greenHeight = Math.max((greenPct / 100) * totalHeight, greenPct > 0 ? 4 : 0);
  const redHeight = Math.max((redPct / 100) * totalHeight, redPct > 0 ? 4 : 0);

  return (
    <div className="flex flex-col items-center" style={{ width: `${BAR_WIDTH}px` }}>
      <div
        className="w-full rounded-t-md overflow-hidden flex flex-col"
        style={{ height: `${greenHeight + redHeight}px` }}
      >
        {/* Red day (top portion) */}
        {redPct > 0 && (
          <div
            className="w-full bg-chart-grey flex items-center justify-center text-[11px] font-semibold text-primary-foreground"
            style={{ height: `${redHeight}px` }}
          >
            {redHeight >= 30 && `${redPct.toFixed(2)}% red day`}
          </div>
        )}
        {/* Green day (bottom portion) */}
        {greenPct > 0 && (
          <div
            className="w-full bg-primary flex items-center justify-center text-[11px] font-semibold text-primary-foreground"
            style={{ height: `${greenHeight}px` }}
          >
            {greenHeight >= 30 && `${greenPct.toFixed(2)}% green day`}
          </div>
        )}
      </div>
    </div>
  );
}

export default OCCDashboard;
