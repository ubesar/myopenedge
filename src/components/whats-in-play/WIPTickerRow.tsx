import { Loader2 } from "lucide-react";
import WIPReportCard, { type ReportCardData } from "./WIPReportCard";

interface Props {
  symbol: string;
  loading: boolean;
  reports: ReportCardData[];
}

export default function WIPTickerRow({ symbol, loading, reports }: Props) {
  return (
    <div className="space-y-3">
      {/* Ticker header */}
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-bold text-foreground uppercase tracking-wide">{symbol}</span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {!loading && reports.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {reports.filter((r) => r.bias === "bullish").length} bullish · {reports.filter((r) => r.bias === "bearish").length} bearish
          </span>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[200px] rounded-xl border border-border bg-card/30 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic pl-1">no data available for this ticker</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {reports.map((rpt) => (
            <WIPReportCard key={rpt.key} report={rpt} symbol={symbol} />
          ))}
        </div>
      )}
    </div>
  );
}
