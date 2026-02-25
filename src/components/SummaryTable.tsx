import type { AnalysisResult } from "@/lib/ib-analysis";

interface SummaryTableProps {
  result: AnalysisResult;
  symbol: string;
}

const SummaryTable = ({ result, symbol }: SummaryTableProps) => {
  const ibLabel = `${result.ibWindowMinutes} min`;
  const totalAnalyzed = result.highFirst.total + result.lowFirst.total;

  const highFirstBreakHighPct = result.highFirst.total > 0 ? (result.highFirst.breakHigh / result.highFirst.total) * 100 : 0;
  const highFirstBreakLowPct = result.highFirst.total > 0 ? (result.highFirst.breakLow / result.highFirst.total) * 100 : 0;
  const lowFirstBreakHighPct = result.lowFirst.total > 0 ? (result.lowFirst.breakHigh / result.lowFirst.total) * 100 : 0;
  const lowFirstBreakLowPct = result.lowFirst.total > 0 ? (result.lowFirst.breakLow / result.lowFirst.total) * 100 : 0;

  const highFirstIsLong = highFirstBreakHighPct > highFirstBreakLowPct;
  const highFirstRec = highFirstIsLong
    ? `When IB High forms first → tends to Break IB High (${highFirstBreakHighPct.toFixed(1)}%). Setup: Long bias after IB ends.`
    : `When IB High forms first → tends to Break IB Low (${highFirstBreakLowPct.toFixed(1)}%). Setup: Short bias after IB ends.`;

  const lowFirstIsLong = lowFirstBreakHighPct > lowFirstBreakLowPct;
  const lowFirstRec = lowFirstIsLong
    ? `When IB Low forms first → tends to Break IB High (${lowFirstBreakHighPct.toFixed(1)}%). Setup: Long bias after IB ends.`
    : `When IB Low forms first → tends to Break IB Low (${lowFirstBreakLowPct.toFixed(1)}%). Setup: Short bias after IB ends.`;

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
        <h3 className="text-xs sm:text-sm font-semibold text-card-foreground">
          📋 Recommendation — {symbol}
        </h3>
        <span className="text-[10px] sm:text-xs text-muted-foreground">
          IB {ibLabel} · {totalAnalyzed} days · <span className="text-yellow-400">{result.insideDays} Inside</span>
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className={`flex-1 rounded-md border px-3 py-1.5 ${highFirstIsLong ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <span className={`text-[10px] font-bold uppercase ${highFirstIsLong ? 'text-emerald-400' : 'text-red-400'}`}>
            {highFirstIsLong ? '▲ LONG' : '▼ SHORT'} — IB High First
          </span>
          <p className="text-xs text-card-foreground mt-0.5">{highFirstRec}</p>
        </div>
        <div className={`flex-1 rounded-md border px-3 py-1.5 ${lowFirstIsLong ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <span className={`text-[10px] font-bold uppercase ${lowFirstIsLong ? 'text-emerald-400' : 'text-red-400'}`}>
            {lowFirstIsLong ? '▲ LONG' : '▼ SHORT'} — IB Low First
          </span>
          <p className="text-xs text-card-foreground mt-0.5">{lowFirstRec}</p>
        </div>
      </div>
    </div>
  );
};

export default SummaryTable;
