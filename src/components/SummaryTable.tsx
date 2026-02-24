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
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md px-4 py-3 shadow-lg">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-card-foreground">
          📋 Rekomendasi — {symbol}
        </h3>
        <span className="text-xs text-muted-foreground">
          IB {ibLabel} · {totalAnalyzed} hari · <span className="text-yellow-400">{result.insideDays} Inside</span>
        </span>
      </div>
      <div className="flex gap-2">
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
