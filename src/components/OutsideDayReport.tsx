import { useState, useMemo } from "react";
import type { OutsideDayResult, OutsideDayData } from "@/lib/outsideday-analysis";

interface OutsideDayReportProps {
  result: OutsideDayResult;
  symbol: string;
  dateRange?: string;
  weekdays?: string;
}

const GAP_FILTERS = [
  { label: "all", min: 0, max: Infinity },
  { label: "< 0.1%", min: 0, max: 0.1 },
  { label: "0.1 – 0.19%", min: 0.1, max: 0.2 },
  { label: "0.20 – 0.39%", min: 0.2, max: 0.4 },
  { label: "0.40 – 0.59%", min: 0.4, max: 0.6 },
  { label: "0.60 – 0.99%", min: 0.6, max: 1.0 },
  { label: "1.0 – 1.49%", min: 1.0, max: 1.5 },
  { label: ">= 1.5%", min: 1.5, max: Infinity },
];

function calcFiltered(days: OutsideDayData[], type: "bullish" | "bearish") {
  const typed = days.filter(d => d.type === type);
  const total = typed.length;
  // "did not reverse" = bullish closed green, bearish closed red
  const didNotReverse = type === "bullish"
    ? typed.filter(d => d.closedGreen === true).length
    : typed.filter(d => d.closedGreen === false).length;
  const reversed = total - didNotReverse;
  return {
    total,
    didNotReverse,
    didNotReversePct: total > 0 ? (didNotReverse / total) * 100 : 0,
    reversed,
    reversedPct: total > 0 ? (reversed / total) * 100 : 0,
  };
}

const OutsideDayReport = ({ result, symbol, dateRange = "" }: OutsideDayReportProps) => {
  const [activeFilter, setActiveFilter] = useState(0);

  const filteredDays = useMemo(() => {
    const f = GAP_FILTERS[activeFilter];
    return result.allDays.filter(d => {
      if (d.type === null) return false;
      const gap = d.gapPct ?? 0;
      return gap >= f.min && gap < f.max;
    });
  }, [result.allDays, activeFilter]);

  const bull = useMemo(() => calcFiltered(filteredDays, "bullish"), [filteredDays]);
  const bear = useMemo(() => calcFiltered(filteredDays, "bearish"), [filteredDays]);

  const allOutside = filteredDays.length;
  const bullPctOfAll = allOutside > 0 ? (bull.total / allOutside) * 100 : 0;
  const bearPctOfAll = allOutside > 0 ? (bear.total / allOutside) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Main layout: Charts + Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Charts panel */}
        <div className="xl:col-span-3 border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium lowercase">charts</p>
            <h3 className="text-sm font-semibold text-foreground mt-1">
              outside days | {symbol} | 9:30 am – 4:00 pm
            </h3>
            {dateRange && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{dateRange}</p>
            )}
          </div>

          {/* Stacked bar chart */}
          <div className="px-5 pb-4 pt-2">
            <div className="flex items-end gap-8 justify-center" style={{ height: 280 }}>
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between h-full text-[10px] text-muted-foreground pr-1">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>

              {/* Bullish bar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-36 sm:w-44" style={{ height: 250 }}>
                  {bull.total > 0 ? (
                    <>
                      {/* Reversal (top - dark) */}
                      <div
                        className="absolute top-0 left-0 right-0 bg-[#374151] rounded-t-md flex items-center justify-center"
                        style={{ height: `${bull.reversedPct}%` }}
                      >
                        {bull.reversedPct >= 10 && (
                          <span className="text-[11px] font-semibold text-white/90">
                            {bull.reversedPct.toFixed(0)}% reversal back down
                          </span>
                        )}
                      </div>
                      {/* Did not reverse (bottom - blue) */}
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-[#3b82f6] rounded-b-md flex items-center justify-center"
                        style={{ height: `${bull.didNotReversePct}%` }}
                      >
                        <span className="text-[11px] font-semibold text-white">
                          {bull.didNotReversePct.toFixed(0)}% did not reverse
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-muted/20 rounded-md flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">no data</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">bullish outside day</span>
              </div>

              {/* Bearish bar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-36 sm:w-44" style={{ height: 250 }}>
                  {bear.total > 0 ? (
                    <>
                      {/* Reversal (top - dark) */}
                      <div
                        className="absolute top-0 left-0 right-0 bg-[#374151] rounded-t-md flex items-center justify-center"
                        style={{ height: `${bear.reversedPct}%` }}
                      >
                        {bear.reversedPct >= 10 && (
                          <span className="text-[11px] font-semibold text-white/90">
                            {bear.reversedPct.toFixed(0)}% reversal back up
                          </span>
                        )}
                      </div>
                      {/* Did not reverse (bottom - blue) */}
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-[#3b82f6] rounded-b-md flex items-center justify-center"
                        style={{ height: `${bear.didNotReversePct}%` }}
                      >
                        <span className="text-[11px] font-semibold text-white">
                          {bear.didNotReversePct.toFixed(0)}% did not reverse
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-muted/20 rounded-md flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">no data</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">bearish outside day</span>
              </div>
            </div>

            {/* Gap size filter buttons */}
            <div className="flex flex-wrap gap-2 mt-5">
              {GAP_FILTERS.map((f, i) => (
                <button
                  key={f.label}
                  onClick={() => setActiveFilter(i)}
                  className={`px-3 py-1.5 text-[11px] rounded-md border transition-colors ${
                    activeFilter === i
                      ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Insights panel */}
        <div className="xl:col-span-2 border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium lowercase">insights</p>
          </div>

          {/* Bullish table */}
          <div className="px-4">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#3b82f6] text-white">
                  <th className="px-3 py-2 text-left font-medium rounded-tl-md">category</th>
                  <th className="px-3 py-2 text-right font-medium">frequency</th>
                  <th className="px-3 py-2 text-right font-medium rounded-tr-md">percentage</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="px-3 py-2.5 text-foreground">bullish outside day</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bull.total}</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bullPctOfAll.toFixed(0)}%</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-3 py-2.5 text-foreground">bullish outside day did not reverse</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bull.didNotReverse}</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">
                    {bull.total > 0 ? bull.didNotReversePct.toFixed(0) : 0}%
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2.5 text-foreground">bullish outside day reversal down</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bull.reversed}</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">
                    {bull.total > 0 ? bull.reversedPct.toFixed(0) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bearish table */}
          <div className="px-4 mt-4 pb-4">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#3b82f6] text-white">
                  <th className="px-3 py-2 text-left font-medium rounded-tl-md">category</th>
                  <th className="px-3 py-2 text-right font-medium">frequency</th>
                  <th className="px-3 py-2 text-right font-medium rounded-tr-md">percentage</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="px-3 py-2.5 text-foreground">bearish outside day</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bear.total}</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bearPctOfAll.toFixed(0)}%</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="px-3 py-2.5 text-foreground">bearish outside day did not reverse</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bear.didNotReverse}</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">
                    {bear.total > 0 ? bear.didNotReversePct.toFixed(0) : 0}%
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-foreground">bearish outside day reversal up</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">{bear.reversed}</td>
                  <td className="px-3 py-2.5 text-right text-foreground font-mono">
                    {bear.total > 0 ? bear.reversedPct.toFixed(0) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutsideDayReport;
