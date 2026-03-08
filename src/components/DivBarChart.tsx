interface BarItem {
  label: string;
  value: number; // percentage 0-100
  color: "blue" | "grey";
}

interface DivBarChartProps {
  bars: BarItem[];
  title: string;
  subtitle?: string;
  legend?: { label: string; color: "blue" | "grey" }[];
  settings?: { label: string; value: string }[];
}

const colorMap = {
  blue: "bg-primary",
  grey: "bg-chart-grey",
};

const DivBarChart = ({ bars, title, subtitle, legend, settings }: DivBarChartProps) => {
  const yLabels = ["80%", "60%", "40%", "20%", "0%"];

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col h-full">
      {/* Header */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-foreground lowercase">charts</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 lowercase leading-tight">{subtitle}</p>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-[200px] flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2 py-1 shrink-0">
          {yLabels.map((l) => (
            <span key={l} className="text-[10px] text-muted-foreground leading-none">{l}</span>
          ))}
        </div>

        {/* Bars container */}
        <div className="flex-1 border-l border-b border-border/30 relative flex items-end justify-center gap-4 sm:gap-8 px-4 pb-1">
          {/* Grid lines */}
          {[80, 60, 40, 20].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-border/20"
              style={{ bottom: `${pct}%` }}
            />
          ))}

          {bars.map((bar, i) => (
            <div key={i} className="flex flex-col items-center z-10 w-16 sm:w-24">
              <div
                className={`w-full rounded-t-md ${colorMap[bar.color]} relative transition-all duration-500 min-h-[24px]`}
                style={{ height: `${Math.max(bar.value, 3)}%` }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-bold text-primary-foreground">
                  {bar.value.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {legend && (
        <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-border/20">
          {legend.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${colorMap[item.color]}`} />
              <span className="text-[10px] text-muted-foreground lowercase">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Settings table */}
      {settings && settings.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground font-medium mb-1.5 lowercase">custom settings</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {settings.map((s, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground lowercase">{s.label}:</span>
                <span className="text-primary font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DivBarChart;
