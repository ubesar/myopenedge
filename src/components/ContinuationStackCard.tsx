interface StackColumn {
  label: string;        // x-axis label e.g. "green candle"
  topPct: number;       // top segment (e.g. red day %)
  bottomPct: number;    // bottom segment (e.g. green day %)
  topLabel: string;     // e.g. "red day"
  bottomLabel: string;  // e.g. "green day"
  total: number;
}

interface ContinuationStackCardProps {
  title: string;       // e.g. "30min opening candle"
  subtitle?: string;   // e.g. "QQQ · 9:30am – 4:00pm"
  columns: StackColumn[];
  legend: { label: string; colorClass: string }[];
}

const CHART_HEIGHT = 220;

const ContinuationStackCard = ({ title, subtitle, columns, legend }: ContinuationStackCardProps) => {
  const yLabels = ["100%", "75%", "50%", "25%", "0%"];

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <h4 className="text-[12px] font-semibold text-foreground lowercase">{title}</h4>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="px-4 py-5">
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

          <div className="flex-1 relative">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {yLabels.map((_, i) => (
                <div key={i} className="border-b border-border/40" />
              ))}
            </div>

            <div
              className="relative flex items-end justify-center gap-6 sm:gap-10"
              style={{ height: `${CHART_HEIGHT}px` }}
            >
              {columns.map((col) => {
                const bottomH = (col.bottomPct / 100) * CHART_HEIGHT;
                const topH = (col.topPct / 100) * CHART_HEIGHT;
                return (
                  <div key={col.label} className="flex flex-col items-center w-[90px] sm:w-[120px]">
                    <div className="w-full flex flex-col rounded-t-md overflow-hidden">
                      {col.topPct > 0 && (
                        <div
                          className="w-full bg-chart-bar-b flex items-center justify-center text-[10px] sm:text-[12px] font-semibold text-primary-foreground transition-all duration-500"
                          style={{ height: `${topH}px` }}
                        >
                          {topH >= 22 && `${col.topPct.toFixed(2)}% ${col.topLabel}`}
                        </div>
                      )}
                      {col.bottomPct > 0 && (
                        <div
                          className="w-full bg-chart-bar-a flex items-center justify-center text-[10px] sm:text-[12px] font-semibold text-primary-foreground transition-all duration-500"
                          style={{ height: `${bottomH}px` }}
                        >
                          {bottomH >= 22 && `${col.bottomPct.toFixed(2)}% ${col.bottomLabel}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-center gap-6 sm:gap-10 ml-8 mt-2">
          {columns.map((col) => (
            <span
              key={col.label}
              className="text-[10px] sm:text-[11px] text-muted-foreground text-center w-[90px] sm:w-[120px]"
            >
              {col.label}
              <span className="block text-[9px] text-muted-foreground/70">{col.total} days</span>
            </span>
          ))}
        </div>

        <div className="flex items-center justify-center gap-5 mt-3 text-[10px]">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${l.colorClass}`} />
              <span className="text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContinuationStackCard;
