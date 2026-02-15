import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalysisResult } from "@/lib/ib-analysis";

interface SummaryTableProps {
  result: AnalysisResult;
  symbol: string;
}

const pct = (n: number, total: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";

const SummaryTable = ({ result, symbol }: SummaryTableProps) => {
  const ibLabel = result.ibWindowMinutes === 60 ? "60 min" : `${result.ibWindowMinutes} min`;
  const totalAnalyzed = result.totalDays + result.insideDays;

  const highFirstBreakHighPct = result.highFirst.total > 0 ? (result.highFirst.breakHigh / result.highFirst.total) * 100 : 0;
  const highFirstBreakLowPct = result.highFirst.total > 0 ? (result.highFirst.breakLow / result.highFirst.total) * 100 : 0;
  const lowFirstBreakHighPct = result.lowFirst.total > 0 ? (result.lowFirst.breakHigh / result.lowFirst.total) * 100 : 0;
  const lowFirstBreakLowPct = result.lowFirst.total > 0 ? (result.lowFirst.breakLow / result.lowFirst.total) * 100 : 0;

  const highFirstRec = highFirstBreakHighPct > highFirstBreakLowPct
    ? `Jika IB High terbentuk duluan → cenderung Break IB High (${highFirstBreakHighPct.toFixed(1)}%). Setup: Bias Long setelah IB selesai.`
    : `Jika IB High terbentuk duluan → cenderung Break IB Low (${highFirstBreakLowPct.toFixed(1)}%). Setup: Bias Short setelah IB selesai.`;

  const lowFirstRec = lowFirstBreakHighPct > lowFirstBreakLowPct
    ? `Jika IB Low terbentuk duluan → cenderung Break IB High (${lowFirstBreakHighPct.toFixed(1)}%). Setup: Bias Long setelah IB selesai.`
    : `Jika IB Low terbentuk duluan → cenderung Break IB Low (${lowFirstBreakLowPct.toFixed(1)}%). Setup: Bias Short setelah IB selesai.`;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-card-foreground mb-1">
        📋 Rekomendasi Setup Hari Ini — {symbol}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        IB Window: First {ibLabel} · {totalAnalyzed} hari trading dianalisis
      </p>
      <div className="space-y-2 mb-4">
        <div className="rounded-md bg-accent/30 border border-accent px-4 py-3">
          <p className="text-sm font-medium text-accent-foreground">{highFirstRec}</p>
        </div>
        <div className="rounded-md bg-accent/30 border border-accent px-4 py-3">
          <p className="text-sm font-medium text-accent-foreground">{lowFirstRec}</p>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Total Trading Days</TableCell>
            <TableCell className="text-right">{totalAnalyzed}</TableCell>
            <TableCell className="text-right">100%</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Breakout Days</TableCell>
            <TableCell className="text-right">{result.totalDays}</TableCell>
            <TableCell className="text-right">{pct(result.totalDays, totalAnalyzed)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Inside Days (no breakout)</TableCell>
            <TableCell className="text-right">{result.insideDays}</TableCell>
            <TableCell className="text-right">{pct(result.insideDays, totalAnalyzed)}</TableCell>
          </TableRow>
          <TableRow className="border-t-2 border-border">
            <TableCell className="font-semibold text-primary" colSpan={3}>
              IB High Formed First ({result.highFirst.total} days)
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="pl-6">→ Broke IB High</TableCell>
            <TableCell className="text-right">{result.highFirst.breakHigh}</TableCell>
            <TableCell className="text-right">{pct(result.highFirst.breakHigh, result.highFirst.total)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="pl-6">→ Broke IB Low</TableCell>
            <TableCell className="text-right">{result.highFirst.breakLow}</TableCell>
            <TableCell className="text-right">{pct(result.highFirst.breakLow, result.highFirst.total)}</TableCell>
          </TableRow>
          <TableRow className="border-t-2 border-border">
            <TableCell className="font-semibold text-primary" colSpan={3}>
              IB Low Formed First ({result.lowFirst.total} days)
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="pl-6">→ Broke IB High</TableCell>
            <TableCell className="text-right">{result.lowFirst.breakHigh}</TableCell>
            <TableCell className="text-right">{pct(result.lowFirst.breakHigh, result.lowFirst.total)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="pl-6">→ Broke IB Low</TableCell>
            <TableCell className="text-right">{result.lowFirst.breakLow}</TableCell>
            <TableCell className="text-right">{pct(result.lowFirst.breakLow, result.lowFirst.total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default SummaryTable;
