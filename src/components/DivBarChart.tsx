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
  const yLabels = ["100%", "80%", "60%", "40%", "20%", "0%"];

  return (
    <div className="rounded-lg border border-border/50 bg-card p-5 flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <p className="text-[11px] font-semibold text-foreground lowercase tracking-wide">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1 lowercase leading-relaxed">{subtitle}</p>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-[220px] flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-3 py-1 shrink-0">
          {yLabels.map((l) => (
            <span key={l} className="text-[10px] text-muted-foreground leading-none font-mono">{l}</span>
          ))}
        </div>

        {/* Bars container */}
        <div className="flex-1 border-l border-b border-border/30 relative flex items-end justify-center gap-6 sm:gap-10 px-6 pb-1">
          {/* Grid lines */}
          {[100, 80, 60, 40, 20].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-border/15"
              style={{ bottom: `${pct}%` }}
            />
          ))}

          {bars.map((bar, i) => (
            <div key={i} className="flex flex-col items-center z-10 w-20 sm:w-28">
              <div
                className={`w-full rounded-t-md ${colorMap[bar.color]} relative transition-all duration-700 ease-out min-h-[28px]`}
                style={{ height: `${Math.max(bar.value, 3)}%` }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary-foreground drop-shadow-sm">
                  {bar.value.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {legend && (
        <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-border/20">
          {legend.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-sm ${colorMap[item.color]}`} />
              <span className="text-[10px] text-muted-foreground lowercase">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Settings table */}
      {settings && settings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground font-semibold mb-2 lowercase tracking-wide">custom settings</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {settings.map((s, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground lowercase">{s.label}</span>
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
