import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { ReportCardData } from "./WIPReportCard";

interface TickerResult {
  symbol: string;
  loading: boolean;
  reports: ReportCardData[];
}

interface Props {
  results: TickerResult[];
}

export default function WIPSummaryBar({ results }: Props) {
  const allReports = results.flatMap((r) => r.reports);
  const bullish = allReports.filter((r) => r.bias === "bullish").length;
  const bearish = allReports.filter((r) => r.bias === "bearish").length;
  const neutral = allReports.filter((r) => r.bias === "neutral").length;
  const total = allReports.length;

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/50 px-5 py-3">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <BarChart3 className="h-4 w-4" />
        <span className="font-semibold text-foreground">{total}</span> reports analyzed
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5 text-[11px]">
        <TrendingUp className="h-3.5 w-3.5 text-profit" />
        <span className="font-semibold text-profit">{bullish}</span>
        <span className="text-muted-foreground">bullish</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <TrendingDown className="h-3.5 w-3.5 text-loss" />
        <span className="font-semibold text-loss">{bearish}</span>
        <span className="text-muted-foreground">bearish</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-semibold text-foreground">{neutral}</span>
        <span className="text-muted-foreground">neutral</span>
      </div>
    </div>
  );
}
