import type { AnalysisResult } from "@/lib/ib-analysis";

interface SummaryTableProps {
  result: AnalysisResult;
  symbol: string;
}

const SummaryTable = ({ result, symbol }: SummaryTableProps) => {
  const ibLabel = `${result.ibWindowMinutes} min`;
  const totalAnalyzed = result.highFirst.total + result.lowFirst.total;

  const highFirstBreakHighPct = result.highFirst.total > 0 ? result.highFirst.breakHigh / result.highFirst.total * 100 : 0;
  const highFirstBreakLowPct = result.highFirst.total > 0 ? result.highFirst.breakLow / result.highFirst.total * 100 : 0;
  const lowFirstBreakHighPct = result.lowFirst.total > 0 ? result.lowFirst.breakHigh / result.lowFirst.total * 100 : 0;
  const lowFirstBreakLowPct = result.lowFirst.total > 0 ? result.lowFirst.breakLow / result.lowFirst.total * 100 : 0;

  const highFirstIsLong = highFirstBreakHighPct > highFirstBreakLowPct;
  const highFirstRec = highFirstIsLong ?
  `Jika IB High terbentuk duluan → cenderung Break IB High (${highFirstBreakHighPct.toFixed(1)}%). Setup: Bias Long setelah IB selesai.` :
  `Jika IB High terbentuk duluan → cenderung Break IB Low (${highFirstBreakLowPct.toFixed(1)}%). Setup: Bias Short setelah IB selesai.`;

  const lowFirstIsLong = lowFirstBreakHighPct > lowFirstBreakLowPct;
  const lowFirstRec = lowFirstIsLong ?
  `Jika IB Low terbentuk duluan → cenderung Break IB High (${lowFirstBreakHighPct.toFixed(1)}%). Setup: Bias Long setelah IB selesai.` :
  `Jika IB Low terbentuk duluan → cenderung Break IB Low (${lowFirstBreakLowPct.toFixed(1)}%). Setup: Bias Short setelah IB selesai.`;

  return;

























};

export default SummaryTable;