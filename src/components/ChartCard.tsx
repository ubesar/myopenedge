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

const yLabels = [80, 60, 40, 20, 0];

const ChartCard = ({ title, subtitle, totalDays, bars, legendItems, settingsGrid }: ChartCardProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-medium text-foreground lowercase">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
          {totalDays} days
        </span>
      </div>

      {/* Pure CSS Bar Chart */}
      <div className="h-[220px] flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2 py-1">
          {yLabels.map((v) => (
            <span key={v} className="text-[10px] text-muted-foreground leading-none">{v}%</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative border-l border-b border-border">
          {/* Horizontal grid lines */}
          {yLabels.slice(0, -1).map((v, i) => (
            <div
              key={v}
              className="absolute w-full border-t border-border"
              style={{ top: `${(i / (yLabels.length - 1)) * 100}%` }}
            />
          ))}

          {/* Bars container */}
          <div className="absolute inset-0 flex items-end justify-center gap-6 px-8 pb-0">
            {bars.map((bar, i) => {
              const heightPct = Math.min(Math.max(bar.value, 0), 100);
              return (
                <div key={i} className="flex flex-col items-center" style={{ width: "80px" }}>
                  <div
                    className={`w-full rounded-t-md relative flex items-center justify-center transition-all duration-500 ${
                      bar.color === "primary" ? "bg-primary" : "bg-chart-grey"
                    }`}
                    style={{ height: `${(heightPct / 80) * 100}%`, minHeight: heightPct > 0 ? "24px" : "0" }}
                  >
                    {heightPct > 0 && (
                      <span className="text-[11px] font-semibold text-primary-foreground">
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

      {/* Legend */}
      {legendItems && legendItems.length > 0 && (
        <div className="flex items-center gap-5 mt-3">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Settings grid */}
      {settingsGrid && settingsGrid.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="section-label mb-2">custom settings</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {settingsGrid.map((s) => (
              <div key={s.label} className="text-[11px]">
                <span className="text-muted-foreground">{s.label}: </span>
                <span className="text-foreground font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartCard;
