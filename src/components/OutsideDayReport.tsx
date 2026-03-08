import type { OutsideDayResult } from "@/lib/outsideday-analysis";
import ChartCard from "@/components/ChartCard";

interface OutsideDayReportProps {
  result: OutsideDayResult;
  symbol: string;
}

const OutsideDayReport = ({ result, symbol }: OutsideDayReportProps) => {
  return (
    <div className="space-y-4">
      {/* Probability Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="bullish outside day → T+1"
          subtitle={`${symbol} · outside days · 9:30–16:00`}
          totalDays={result.bullishOutside}
          bars={[
            { name: "continuation", value: result.bullishContinuationPct, color: "primary" },
            { name: "reversal", value: result.bullishReversalPct, color: "muted" },
          ]}
          legendItems={[
            { label: "continuation (broke high first)", color: "hsl(217,91%,60%)" },
            { label: "reversal (broke low first)", color: "hsl(240,5%,30%)" },
          ]}
          settingsGrid={[
            { label: "sentiment", value: "bullish (close > open)" },
            { label: "session", value: "9:30–16:00" },
            { label: "detection", value: "H > prev H & L < prev L" },
          ]}
        />
        <ChartCard
          title="bearish outside day → T+1"
          subtitle={`${symbol} · outside days · 9:30–16:00`}
          totalDays={result.bearishOutside}
          bars={[
            { name: "continuation", value: result.bearishContinuationPct, color: "primary" },
            { name: "reversal", value: result.bearishReversalPct, color: "muted" },
          ]}
          legendItems={[
            { label: "continuation (broke low first)", color: "hsl(217,91%,60%)" },
            { label: "reversal (broke high first)", color: "hsl(240,5%,30%)" },
          ]}
          settingsGrid={[
            { label: "sentiment", value: "bearish (close < open)" },
            { label: "session", value: "9:30–16:00" },
            { label: "detection", value: "H > prev H & L < prev L" },
          ]}
        />
      </div>

      {/* 1:1 RR Simulation */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <h4 className="text-[13px] font-semibold text-foreground lowercase">1:1 RR simulator · bullish</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              entry: next open · SL: outside bar low · TP: 1R
            </p>
          </div>
          <div className="px-5 py-6 flex flex-col items-center">
            <div className="w-full h-1.5 rounded-full bg-muted mb-4">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(result.bullishRRPct, 100)}%` }}
              />
            </div>
            <p className="text-[28px] font-bold text-primary">
              {result.bullishRRPct.toFixed(2)}%
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">win rate at 1:1 RR</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {result.bullishRRHits} wins out of {result.bullishOutside} bullish outside days
            </p>
          </div>
        </div>

        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <h4 className="text-[13px] font-semibold text-foreground lowercase">1:1 RR simulator · bearish</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              entry: next open · SL: outside bar high · TP: 1R
            </p>
          </div>
          <div className="px-5 py-6 flex flex-col items-center">
            <div className="w-full h-1.5 rounded-full bg-muted mb-4">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(result.bearishRRPct, 100)}%` }}
              />
            </div>
            <p className="text-[28px] font-bold text-primary">
              {result.bearishRRPct.toFixed(2)}%
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">win rate at 1:1 RR</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {result.bearishRRHits} wins out of {result.bearishOutside} bearish outside days
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
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
            <p className="text-[22px] font-bold text-foreground">{result.bullishOutside}</p>
            <p className="text-[11px] text-muted-foreground">bullish outside</p>
          </div>
          <div className="text-center">
            <p className="text-[22px] font-bold text-foreground">{result.bearishOutside}</p>
            <p className="text-[11px] text-muted-foreground">bearish outside</p>
          </div>
        </div>
      </div>

      {/* Historical Log */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h4 className="text-[13px] font-semibold text-foreground lowercase">execution log</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">historical outside day occurrences</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">date</th>
                <th className="px-4 py-2 text-left font-medium">sentiment</th>
                <th className="px-4 py-2 text-left font-medium">T+1 result</th>
                <th className="px-4 py-2 text-left font-medium">1:1 RR</th>
                <th className="px-4 py-2 text-right font-medium">high</th>
                <th className="px-4 py-2 text-right font-medium">low</th>
              </tr>
            </thead>
            <tbody>
              {result.allDays
                .filter((d) => d.isOutsideDay)
                .reverse()
                .slice(0, 50)
                .map((d) => (
                  <tr key={d.date} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-foreground">{d.date}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        d.sentiment === "bullish"
                          ? "bg-primary/15 text-primary"
                          : "bg-destructive/15 text-destructive"
                      }`}>
                        {d.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-[11px] font-medium ${
                        d.nextDayResult === "continuation" ? "text-primary" :
                        d.nextDayResult === "reversal" ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {d.nextDayResult || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {d.rrHit === true && <span className="text-primary font-semibold">✓ win</span>}
                      {d.rrHit === false && <span className="text-destructive font-semibold">✗ loss</span>}
                      {d.rrHit === null && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{d.high.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{d.low.toFixed(2)}</td>
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
