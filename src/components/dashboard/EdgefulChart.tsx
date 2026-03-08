// --- NEW UI LAYOUT --- Edgeful-style vertical bar chart card
interface BarItem {
  label: string;
  value: number; // percentage 0-100
  color: "blue" | "grey" | "green" | "red" | "yellow";
}

interface EdgefulChartProps {
  title: string;
  subtitle?: string;
  bars: BarItem[];
  legend?: { label: string; color: string }[];
  settingsRows?: { label: string; value: string }[];
  totalDays?: number;
}

const COLOR_MAP = {
  blue: "bg-primary",
  grey: "bg-chart-grey",
  green: "bg-[hsl(142,71%,45%)]",
  red: "bg-[hsl(0,84%,60%)]",
  yellow: "bg-[hsl(45,100%,50%)]",
};

const EdgefulChart = ({ title, subtitle, bars, legend, settingsRows, totalDays }: EdgefulChartProps) => {
  const maxVal = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="rounded-xl border border-border/30 bg-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/20">
        <h3 className="text-xs font-semibold text-foreground lowercase">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 lowercase">{subtitle}</p>}
        {totalDays !== undefined && (
          <p className="text-[10px] text-muted-foreground lowercase">{totalDays} trading days</p>
        )}
      </div>

      {/* Chart Area */}
      <div className="flex-1 px-4 py-4 flex items-end justify-center gap-6 min-h-[200px] sm:min-h-[260px]">
        {bars.map((bar, i) => {
          const heightPct = maxVal > 0 ? (bar.value / 100) * 100 : 0;
          return (
            <div key={i} className="flex flex-col items-center gap-2 flex-1 max-w-[100px]">
              {/* Percentage label */}
              <span className="text-sm font-bold text-foreground">{bar.value.toFixed(1)}%</span>
              {/* Bar */}
              <div className="w-full bg-secondary/50 rounded-t-md relative" style={{ height: "180px" }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 ${COLOR_MAP[bar.color]}`}
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              </div>
              {/* Label */}
              <span className="text-[10px] text-muted-foreground text-center lowercase leading-tight">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {legend && legend.length > 0 && (
        <div className="px-4 pb-2 flex items-center justify-center gap-4">
          {legend.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />
              <span className="text-[10px] text-muted-foreground lowercase">{l.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Custom Settings Table */}
      {settingsRows && settingsRows.length > 0 && (
        <div className="border-t border-border/20">
          <div className="px-4 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
              custom settings
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {settingsRows.map((row, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground lowercase">{row.label}:</span>
                  <span className="text-primary font-medium lowercase">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EdgefulChart;
