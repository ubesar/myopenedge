interface BarData {
  name: string;
  value: number;
  color: "primary" | "muted";
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  totalDays: number;
  bars: BarData[];
  legendItems?: { label: string; color?: string }[];
  settingsGrid?: { label: string; value: string }[];
}

const CHART_HEIGHT = 200;
const yLabels = ["100%", "80%", "60%", "40%", "20%", "0%"];

const ChartCard = ({ title, subtitle, totalDays, bars, legendItems, settingsGrid }: ChartCardProps) => {
  return (
    <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden min-w-0">
      {/* Header */}
      <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2 sm:pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] sm:text-[13px] font-semibold text-foreground lowercase truncate">{title}</h4>
            {subtitle && <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium whitespace-nowrap shrink-0">
            {totalDays} days
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-3 sm:px-5 py-4 sm:py-5">
        <div className="flex items-end gap-0">
          {/* Y axis */}
          <div className="flex flex-col justify-between pr-1 sm:pr-2 text-[9px] sm:text-[10px] text-muted-foreground pb-1" style={{ height: `${CHART_HEIGHT}px` }}>
            {yLabels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>

          {/* Bars area */}
          <div className="flex-1 relative min-w-0">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {yLabels.map((_, i) => (
                <div key={i} className="border-b border-border/50" />
              ))}
            </div>

            {/* Bars */}
            <div className="relative flex items-end justify-center gap-3 sm:gap-8" style={{ height: `${CHART_HEIGHT}px` }}>
              {bars.map((bar, i) => {
                const clampedValue = Math.min(Math.max(bar.value, 0), 100);
                const barHeight = Math.max((clampedValue / 100) * CHART_HEIGHT, clampedValue > 0 ? 4 : 0);
                const showInsideLabel = barHeight >= 28;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 w-[60px] sm:w-[90px]">
                    <div
                      className={`w-full rounded-t-md flex items-end justify-center pb-1.5 sm:pb-2 text-[10px] sm:text-[12px] font-semibold transition-all duration-500 ${
                        bar.color === "primary"
                          ? "bg-chart-bar-a text-primary-foreground"
                          : "bg-chart-bar-b text-primary-foreground"
                      }`}
                      style={{ height: `${barHeight}px` }}
                    >
                      {clampedValue > 0 && (
                        <span className={showInsideLabel ? "" : "relative -top-5"}>
                          {bar.value.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex items-start justify-center gap-3 sm:gap-8 ml-6 sm:ml-8 mt-2">
          {bars.map((bar, i) => (
            <span key={i} className="text-[9px] sm:text-[10px] text-muted-foreground text-center lowercase w-[60px] sm:w-[90px]">
              {bar.name}
            </span>
          ))}
        </div>

        {/* Legend */}
        {legendItems && legendItems.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-1.5 sm:gap-6 mt-3 sm:mt-4 text-[10px] sm:text-[11px]">
            {legendItems.map((item, i) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-chart-bar-a" : "bg-chart-bar-b"}`} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Settings */}
      {settingsGrid && settingsGrid.length > 0 && (
        <div className="border-t border-border px-3 sm:px-5 py-2.5 sm:py-3">
          <h5 className="text-[10px] sm:text-[11px] text-muted-foreground mb-1.5 sm:mb-2 uppercase tracking-wider">custom settings</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 sm:gap-y-1.5 text-[10px] sm:text-[11px]">
            {settingsGrid.map((s) => (
              <div key={s.label} className="flex justify-between">
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="text-primary font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartCard;
