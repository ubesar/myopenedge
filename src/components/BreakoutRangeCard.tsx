import { ArrowUp, ArrowDown } from "lucide-react";
import type { BreakoutRangeStats } from "@/lib/ib-analysis";

interface BreakoutRangeCardProps {
  stats: BreakoutRangeStats;
}

const BreakoutRangeCard = ({ stats }: BreakoutRangeCardProps) => {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-card-foreground mb-1">
        📏 Average Breakout Range (Ticks)
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Rata-rata range setelah breakout melewati level IB
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ArrowUp className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Break IB High
            </span>
          </div>
          <p className="text-2xl font-bold text-card-foreground">
            {stats.avgBreakHighRange.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">ticks avg</p>
        </div>
        <div className="rounded-md border border-gray-500/30 bg-gray-500/10 px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ArrowDown className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Break IB Low
            </span>
          </div>
          <p className="text-2xl font-bold text-card-foreground">
            {stats.avgBreakLowRange.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">ticks avg</p>
        </div>
      </div>
    </div>
  );
};

export default BreakoutRangeCard;
