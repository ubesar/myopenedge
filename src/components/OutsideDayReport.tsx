import type { OutsideDayResult } from "@/lib/outsideday-analysis";
import ChartCard from "@/components/ChartCard";

interface OutsideDayReportProps {
  result: OutsideDayResult;
  symbol: string;
  dateRange?: string;
  weekdays?: string;
}

const OutsideDayReport = ({ result, symbol, dateRange = "", weekdays = "" }: OutsideDayReportProps) => {
  const { bullish, bearish } = result;

  return (
    <div className="space-y-4">
      {/* Gap Fill Probability */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="bullish outside day"
          subtitle={`${symbol} · open > yesterday's high`}
          totalDays={bullish.total}
          bars={[
            { name: "filled gap (touched prior high)", value: bullish.filledGapPct, color: "primary" },
            { name: "continued higher", value: bullish.didNotFillPct, color: "muted" },
          ]}
          legendItems={[
            { label: "retraced to prior high", color: "hsl(var(--chart-bar-a))" },
            { label: "continued higher", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={[
            { label: "trigger", value: "open > yesterday's high" },
            { label: "session", value: "9:30–16:00 ET" },
            ...(dateRange ? [{ label: "date range", value: dateRange }] : []),
            ...(weekdays ? [{ label: "weekdays", value: weekdays }] : []),
          ]}
        />
        <ChartCard
          title="bearish outside day"
          subtitle={`${symbol} · open < yesterday's low`}
          totalDays={bearish.total}
          bars={[
            { name: "filled gap (touched prior low)", value: bearish.filledGapPct, color: "primary" },
            { name: "continued lower", value: bearish.didNotFillPct, color: "muted" },
          ]}
          legendItems={[
            { label: "retraced to prior low", color: "hsl(var(--chart-bar-a))" },
            { label: "continued lower", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={[
            { label: "trigger", value: "open < yesterday's low" },
            { label: "session", value: "9:30–16:00 ET" },
            ...(dateRange ? [{ label: "date range", value: dateRange }] : []),
            ...(weekdays ? [{ label: "weekdays", value: weekdays }] : []),
          ]}
        />
      </div>

      {/* By Close Report */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="bullish outside day → by close"
          subtitle={`${symbol} · session close direction after bullish outside day`}
          totalDays={bullish.total}
          bars={[
            { name: "closed green", value: bullish.closedGreenPct, color: "primary" },
            { name: "closed red", value: bullish.closedRedPct, color: "muted" },
          ]}
          legendItems={[
            { label: "closed above prior high (green)", color: "hsl(var(--chart-bar-a))" },
            { label: "closed below prior high (red)", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={[
            { label: "filter", value: "by close" },
            { label: "session", value: "9:30–16:00 ET" },
          ]}
        />
        <ChartCard
          title="bearish outside day → by close"
          subtitle={`${symbol} · session close direction after bearish outside day`}
          totalDays={bearish.total}
          bars={[
            { name: "closed green", value: bearish.closedGreenPct, color: "primary" },
            { name: "closed red", value: bearish.closedRedPct, color: "muted" },
          ]}
          legendItems={[
            { label: "closed green", color: "hsl(var(--chart-bar-a))" },
            { label: "closed red", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={[
            { label: "filter", value: "by close" },
            { label: "session", value: "9:30–16:00 ET" },
          ]}
        />
      </div>

      {/* Overview */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h4 className="text-[13px] font-semibold text-foreground lowercase">overview</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {symbol} · {result.totalDays} trading days analyzed
          </p>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-[22px] font-bold text-foreground">{result.outsideDays}</p>
            <p className="text-[11px] text-muted-foreground">outside days</p>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-bold text-primary">{result.outsidePct.toFixed(1)}%</p>
            <p className="text-[11px] text-muted-foreground">occurrence rate</p>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-bold text-foreground">{bullish.total}</p>
            <p className="text-[11px] text-muted-foreground">bullish (open &gt; high)</p>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-bold text-foreground">{bearish.total}</p>
            <p className="text-[11px] text-muted-foreground">bearish (open &lt; low)</p>
          </div>
        </div>
      </div>

      {/* Execution Log */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h4 className="text-[13px] font-semibold text-foreground lowercase">execution log</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">historical outside day instances</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">date</th>
                <th className="px-4 py-2 text-left font-medium">type</th>
                <th className="px-4 py-2 text-left font-medium">gap size</th>
                <th className="px-4 py-2 text-left font-medium">filled gap</th>
                <th className="px-4 py-2 text-left font-medium">close</th>
                <th className="px-4 py-2 text-right font-medium">open</th>
                <th className="px-4 py-2 text-right font-medium">close</th>
              </tr>
            </thead>
            <tbody>
              {result.allDays
                .filter(d => d.type !== null)
                .reverse()
                .slice(0, 50)
                .map(d => (
                  <tr key={d.date} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-foreground">{d.date}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        d.type === "bullish"
                          ? "bg-primary/15 text-primary"
                          : "bg-destructive/15 text-destructive"
                      }`}>
                        {d.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-foreground">{d.gapPct?.toFixed(2)}%</td>
                    <td className="px-4 py-2">
                      {d.filledGap === true && <span className="text-primary font-semibold">✓ yes</span>}
                      {d.filledGap === false && <span className="text-muted-foreground">✗ no</span>}
                    </td>
                    <td className="px-4 py-2">
                      {d.closedGreen === true && <span className="text-primary font-semibold">green</span>}
                      {d.closedGreen === false && <span className="text-destructive font-semibold">red</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{d.open.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{d.close.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OutsideDayReport;
