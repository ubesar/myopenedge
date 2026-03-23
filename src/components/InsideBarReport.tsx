import type { InsideBarResult } from "@/lib/insidebar-analysis";

interface InsideBarReportProps {
  result: InsideBarResult;
  symbol: string;
}

const PieChart = ({ outsidePct, insidePct }: { outsidePct: number; insidePct: number }) => {
  // SVG pie chart
  const total = outsidePct + insidePct;
  if (total === 0) return null;

  const outsideAngle = (outsidePct / 100) * 360;

  // Calculate SVG arc path for outside days (primary/blue)
  const centerX = 120;
  const centerY = 120;
  const radius = 100;

  const toRadians = (deg: number) => (deg - 90) * (Math.PI / 180);

  // Outside days slice (starts at top, goes clockwise)
  const outsideEndAngle = outsideAngle;
  const outsideLargeArc = outsideAngle > 180 ? 1 : 0;

  const outsideX1 = centerX + radius * Math.cos(toRadians(0));
  const outsideY1 = centerY + radius * Math.sin(toRadians(0));
  const outsideX2 = centerX + radius * Math.cos(toRadians(outsideEndAngle));
  const outsideY2 = centerY + radius * Math.sin(toRadians(outsideEndAngle));

  const outsidePath = outsidePct >= 100
    ? `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX - 0.01} ${centerY - radius} Z`
    : `M ${centerX} ${centerY} L ${outsideX1} ${outsideY1} A ${radius} ${radius} 0 ${outsideLargeArc} 1 ${outsideX2} ${outsideY2} Z`;

  // Inside days slice (remaining)
  const insidePath = insidePct >= 100
    ? `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX - 0.01} ${centerY - radius} Z`
    : `M ${centerX} ${centerY} L ${outsideX2} ${outsideY2} A ${radius} ${radius} 0 ${outsideAngle <= 180 ? 1 : 0} 1 ${outsideX1} ${outsideY1} Z`;

  // Label positions (midpoint of each arc)
  const outsideMidAngle = outsideAngle / 2;
  const insideMidAngle = outsideAngle + (360 - outsideAngle) / 2;
  const labelRadius = radius * 0.6;

  const outsideLabelX = centerX + labelRadius * Math.cos(toRadians(outsideMidAngle));
  const outsideLabelY = centerY + labelRadius * Math.sin(toRadians(outsideMidAngle));
  const insideLabelX = centerX + labelRadius * Math.cos(toRadians(insideMidAngle));
  const insideLabelY = centerY + labelRadius * Math.sin(toRadians(insideMidAngle));

  return (
    <div className="flex flex-col items-center">
      <svg width="240" height="240" viewBox="0 0 240 240">
        {/* Outside days (chart-donut-a) */}
        {outsidePct > 0 && (
          <path d={outsidePath} fill="hsl(var(--chart-donut-a))" />
        )}
        {/* Inside days (chart-donut-b) */}
        {insidePct > 0 && (
          <path d={insidePath} fill="hsl(var(--chart-donut-b))" />
        )}
        {/* Labels */}
        {outsidePct > 5 && (
          <text x={outsideLabelX} y={outsideLabelY} textAnchor="middle" dominantBaseline="central" className="fill-primary-foreground text-[13px] font-semibold">
            {outsidePct.toFixed(2)}%
          </text>
        )}
        {insidePct > 5 && (
          <text x={insideLabelX} y={insideLabelY} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[13px] font-semibold">
            {insidePct.toFixed(2)}%
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0 bg-primary" />
          <span className="text-muted-foreground">outside days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(240,5%,30%)" }} />
          <span className="text-muted-foreground">inside days</span>
        </div>
      </div>
    </div>
  );
};

const InsideBarReport = ({ result, symbol }: InsideBarReportProps) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Left: Pie Chart Card */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-[13px] font-semibold text-foreground lowercase">charts</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {symbol} inside bars · 9:30 am – 4:00 pm
              </p>
            </div>
            <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
              {result.totalDays} days
            </span>
          </div>
        </div>

        <div className="px-5 py-6 flex justify-center">
          <PieChart outsidePct={result.outsidePct} insidePct={result.insideBarPct} />
        </div>

        {/* Custom Settings */}
        <div className="border-t border-border px-5 py-3">
          <h5 className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">custom settings</h5>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">period length:</span>
              <span className="text-primary font-medium">days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">session:</span>
              <span className="text-primary font-medium">9:30–16:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Insights Card */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-[13px] font-semibold text-foreground lowercase">insights</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {symbol} inside bars · 9:30 am – 4:00 pm
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Stayed Inside Insight */}
          <div className="border border-border rounded-lg p-5 text-center">
            {/* Progress bar - muted */}
            <div className="w-full h-1.5 rounded-full bg-muted mb-4">
              <div
                className="h-full rounded-full bg-muted-foreground/40 transition-all duration-500"
                style={{ width: `${Math.min(result.stayedPct, 100)}%` }}
              />
            </div>
            <p className="text-[28px] font-bold text-foreground">
              {result.stayedPct.toFixed(2)}%
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              opened within yesterday's range
            </p>
            <p className="text-[13px] text-muted-foreground">
              stayed within yesterday's range
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              {result.stayedInsideDays} out of {result.insideBarDays} days
            </p>
          </div>

          {/* Broke Out Insight */}
          <div className="border border-border rounded-lg p-5 text-center">
            {/* Progress bar - primary */}
            <div className="w-full h-1.5 rounded-full bg-muted mb-4">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(result.breakoutPct, 100)}%` }}
              />
            </div>
            <p className="text-[28px] font-bold text-primary">
              {result.breakoutPct.toFixed(2)}%
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              opened within yesterday's range
            </p>
            <p className="text-[13px] text-muted-foreground">
              broke out of yesterday's range
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              {result.brokeOutDays} out of {result.insideBarDays} days
            </p>
          </div>

          {/* Breakout Direction Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border rounded-lg p-3 text-center">
              <p className="text-[20px] font-bold text-primary">
                {result.brokeHighPct.toFixed(1)}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">broke high</p>
              <p className="text-[10px] text-muted-foreground">{result.brokeHighDays} days</p>
            </div>
            <div className="border border-border rounded-lg p-3 text-center">
              <p className="text-[20px] font-bold text-muted-foreground">
                {result.brokeLowPct.toFixed(1)}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">broke low</p>
              <p className="text-[10px] text-muted-foreground">{result.brokeLowDays} days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsideBarReport;
