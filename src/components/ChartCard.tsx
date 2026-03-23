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
  legendItems?: { label: string; color: string }[];
  settingsGrid?: { label: string; value: string }[];
}

const CHART_HEIGHT = 200;
const yLabels = ["100%", "80%", "60%", "40%", "20%", "0%"];

const ChartCard = ({ title, subtitle, totalDays, bars, legendItems, settingsGrid }: ChartCardProps) => {
  return (
    <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-[13px] font-semibold text-foreground lowercase">{title}</h4>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            {totalDays} days
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 py-5">
        <div className="flex items-end gap-0">
          {/* Y axis */}
          <div className="flex flex-col justify-between pr-2 text-[10px] text-muted-foreground pb-1" style={{ height: `${CHART_HEIGHT}px` }}>
            {yLabels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>

          {/* Bars area */}
          <div className="flex-1 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {yLabels.map((_, i) => (
                <div key={i} className="border-b border-border/50" />
              ))}
            </div>

            {/* Bars */}
            <div className="relative flex items-end justify-center gap-8" style={{ height: `${CHART_HEIGHT}px` }}>
              {bars.map((bar, i) => {
                // Map value (0-100%) to pixel height within CHART_HEIGHT
                const clampedValue = Math.min(Math.max(bar.value, 0), 100);
                const barHeight = Math.max((clampedValue / 100) * CHART_HEIGHT, clampedValue > 0 ? 4 : 0);
                const showInsideLabel = barHeight >= 28;
                return (
                   <div key={i} className="flex flex-col items-center gap-1" style={{ width: "90px" }}>
                    <div
                      className={`w-full rounded-t-md flex items-end justify-center pb-2 text-[12px] font-semibold transition-all duration-500 ${
                        bar.color === "primary"
                          ? "bg-chart-bar-a text-primary-foreground"
                          : "bg-chart-bar-b text-primary-foreground"
                      }`}
                      style={{ height: `${barHeight}px` }}
                    >
                      {clampedValue > 0 && (
                        <span className={showInsideLabel ? "" : "relative -top-5"}>
                          {bar.value.toFixed(2)}%
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
        <div className="flex items-start justify-center gap-8 ml-8 mt-2">
          {bars.map((bar, i) => (
            <span key={i} className="text-[10px] text-muted-foreground text-center lowercase" style={{ width: "90px" }}>
              {bar.name}
            </span>
          ))}
        </div>

        {/* Legend */}
        {legendItems && legendItems.length > 0 && (
          <div className="flex items-center justify-center gap-6 mt-4 text-[11px]">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Settings */}
      {settingsGrid && settingsGrid.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <h5 className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
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
