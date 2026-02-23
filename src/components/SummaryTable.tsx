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
    ? `Jika IB High terbentuk duluan → cenderung Break IB High (${highFirstBreakHighPct.toFixed(1)}%). Setup: Bias Long setelah IB selesai.`
    : `Jika IB High terbentuk duluan → cenderung Break IB Low (${highFirstBreakLowPct.toFixed(1)}%). Setup: Bias Short setelah IB selesai.`;

  const lowFirstIsLong = lowFirstBreakHighPct > lowFirstBreakLowPct;
  const lowFirstRec = lowFirstIsLong
    ? `Jika IB Low terbentuk duluan → cenderung Break IB High (${lowFirstBreakHighPct.toFixed(1)}%). Setup: Bias Long setelah IB selesai.`
    : `Jika IB Low terbentuk duluan → cenderung Break IB Low (${lowFirstBreakLowPct.toFixed(1)}%). Setup: Bias Short setelah IB selesai.`;

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4 shadow-lg">
      <h3 className="text-sm font-semibold text-card-foreground mb-0.5">
        📋 Rekomendasi Setup Hari Ini — {symbol}
      </h3>
      <p className="text-xs text-muted-foreground mb-2">
        IB Window: First {ibLabel} · {totalAnalyzed} hari trading · <span className="text-yellow-400">{result.insideDays} Inside Days</span>
      </p>
      <div className="space-y-1.5">
        <div className={`rounded-md border px-3 py-2 ${highFirstIsLong ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${highFirstIsLong ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${highFirstIsLong ? 'text-emerald-400' : 'text-red-400'}`}>
              {highFirstIsLong ? 'LONG BIAS' : 'SHORT BIAS'}
            </span>
          </div>
          <p className="text-xs font-medium text-card-foreground mt-0.5">{highFirstRec}</p>
        </div>
        <div className={`rounded-md border px-3 py-2 ${lowFirstIsLong ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${lowFirstIsLong ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${lowFirstIsLong ? 'text-emerald-400' : 'text-red-400'}`}>
              {lowFirstIsLong ? 'LONG BIAS' : 'SHORT BIAS'}
            </span>
          </div>
          <p className="text-xs font-medium text-card-foreground mt-0.5">{lowFirstRec}</p>
        </div>
      </div>
    </div>
  );
};

export default SummaryTable;
