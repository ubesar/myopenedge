import type { OCCResult, OCCCandleSize } from "@/lib/occ-analysis";

interface OCCDashboardProps {
  result: OCCResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
  candleSize: OCCCandleSize;
  onCandleSizeChange: (size: OCCCandleSize) => void;
}

const CANDLE_SIZES: { value: OCCCandleSize; label: string }[] = [
  { value: "5m", label: "5min" },
  { value: "15m", label: "15min" },
  { value: "30m", label: "30min" },
  { value: "1h", label: "1hour" },
];

const CHART_HEIGHT = 260;

const candleSizeLabel = (cs: OCCCandleSize) =>
  cs === "5m" ? "5min" : cs === "15m" ? "15min" : cs === "30m" ? "30min" : "60min";

const OCCDashboard = ({ result, symbol, dateRange, weekdays, candleSize, onCandleSizeChange }: OCCDashboardProps) => {
  const { greenCandle, redCandle } = result;

  const columns = [
    {
      label: "green candle",
      greenPct: greenCandle.greenDayPct,
      redPct: greenCandle.redDayPct,
      total: greenCandle.total,
    },
    {
      label: "red candle",
      greenPct: redCandle.greenDayPct,
      redPct: redCandle.redDayPct,
      total: redCandle.total,
    },
  ];

  const yLabels = ["100%", "75%", "50%", "25%", "0%"];

  return (
    <div className="space-y-4">
      {/* Main chart card */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <p className="text-[11px] text-muted-foreground">
            {symbol} {candleSizeLabel(candleSize)} opening candle continuation
            <span className="mx-1.5">|</span>
            {dateRange}
            <span className="mx-1.5">|</span>
            9:30 am – 4:00 pm
          </p>
        </div>

        {/* Stacked bar chart */}
        <div className="px-4 py-6">
          <div className="flex items-end gap-0">
            {/* Y axis */}
            <div
              className="flex flex-col justify-between pr-2 text-[10px] text-muted-foreground pb-1"
              style={{ height: `${CHART_HEIGHT}px` }}
            >
              {yLabels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>

            {/* Bars area */}
            <div className="flex-1 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {yLabels.map((_, i) => (
                  <div key={i} className="border-b border-border/40" />
                ))}
              </div>

              {/* Stacked bars */}
              <div
                className="relative flex items-end justify-center gap-8 sm:gap-16"
                style={{ height: `${CHART_HEIGHT}px` }}
              >
                {columns.map((col) => {
                  const greenH = (col.greenPct / 100) * CHART_HEIGHT;
                  const redH = (col.redPct / 100) * CHART_HEIGHT;
                  return (
                    <div key={col.label} className="flex flex-col items-center w-[100px] sm:w-[140px]">
                      {/* Stacked bar – red on top, green on bottom */}
                      <div className="w-full flex flex-col rounded-t-md overflow-hidden">
                        {/* Red segment (top) */}
                        {col.redPct > 0 && (
                          <div
                            className="w-full bg-chart-bar-b flex items-center justify-center text-[11px] sm:text-[13px] font-semibold text-primary-foreground transition-all duration-500"
                            style={{ height: `${redH}px` }}
                          >
                            {redH >= 24 && `${col.redPct.toFixed(2)}% red day`}
                          </div>
                        )}
                        {/* Green segment (bottom) */}
                        {col.greenPct > 0 && (
                          <div
                            className="w-full bg-chart-bar-a flex items-center justify-center text-[11px] sm:text-[13px] font-semibold text-primary-foreground transition-all duration-500"
                            style={{ height: `${greenH}px` }}
                          >
                            {greenH >= 24 && `${col.greenPct.toFixed(2)}% green day`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex items-start justify-center gap-8 sm:gap-16 ml-8 mt-2">
            {columns.map((col) => (
              <span
                key={col.label}
                className="text-[10px] sm:text-[11px] text-muted-foreground text-center w-[100px] sm:w-[140px]"
              >
                {col.label}
              </span>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-chart-bar-a" />
              <span className="text-muted-foreground">% green day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-chart-bar-b" />
              <span className="text-muted-foreground">% red day</span>
            </div>
          </div>
        </div>

        {/* Custom Settings */}
        <div className="border-t border-border px-4 py-3">
          <h5 className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">opening candle size:</span>
              <span className="text-primary font-medium">{candleSizeLabel(candleSize)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">session:</span>
              <span className="text-primary font-medium">9:30 am – 4:00 pm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">breakout measure:</span>
              <span className="text-primary font-medium">daily close vs daily open</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">date range:</span>
              <span className="text-primary font-medium">{dateRange}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">weekdays:</span>
              <span className="text-primary font-medium">{weekdays}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Candle size selector */}
      <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">change opening candle size</span>
        <div className="flex gap-1.5 mt-2">
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
  );
};

export default OCCDashboard;
