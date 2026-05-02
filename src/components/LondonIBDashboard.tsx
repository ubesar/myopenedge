import ChartCard from "@/components/ChartCard";
import AITradingInsight from "@/components/AITradingInsight";
import type { LondonIBResult } from "@/lib/london-ib-analysis";

interface LondonIBDashboardProps {
  result: LondonIBResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

const LondonIBDashboard = ({ result, symbol, dateRange, weekdays }: LondonIBDashboardProps) => {
  const hf = result.highFirst;
  const lf = result.lowFirst;
  const bs = result.breakTypeStats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="london IB high formed first"
          subtitle={`${symbol} · london session breakout`}
          totalDays={hf.total}
          bars={[
            { name: "first break IB high", value: hf.total > 0 ? (hf.breakHigh / hf.total * 100) : 0, color: "primary" },
            { name: "first break IB low", value: hf.total > 0 ? (hf.breakLow / hf.total * 100) : 0, color: "muted" },
          ]}
          legendItems={[
            { label: "first break IB high", color: "hsl(var(--chart-bar-a))" },
            { label: "first break IB low", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={[
            { label: "IB timeframe", value: `${result.ibWindowMinutes} min` },
            { label: "london session", value: "03:00 AM – 11:30 AM ET" },
            { label: "candle timeframe", value: "5min" },
            { label: "breakout measure", value: "by rejection (M5 close)" },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />
        <ChartCard
          title="london IB low formed first"
          subtitle={`${symbol} · london session breakout`}
          totalDays={lf.total}
          bars={[
            { name: "first break IB high", value: lf.total > 0 ? (lf.breakHigh / lf.total * 100) : 0, color: "primary" },
            { name: "first break IB low", value: lf.total > 0 ? (lf.breakLow / lf.total * 100) : 0, color: "muted" },
          ]}
          legendItems={[
            { label: "first break IB high", color: "hsl(var(--chart-bar-a))" },
            { label: "first break IB low", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={[
            { label: "IB timeframe", value: `${result.ibWindowMinutes} min` },
            { label: "london session", value: "03:00 AM – 11:30 AM ET" },
            { label: "candle timeframe", value: "5min" },
            { label: "breakout measure", value: "by rejection (M5 close)" },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />
      </div>

      {/* Break Type Stats */}
      <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4">
        <h3 className="text-[13px] font-semibold text-foreground mb-3 lowercase">
          london IB break type statistics
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          how often does price single break, double break, or stay inside the london IB range?
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">single break</p>
            <p className="text-lg font-semibold text-foreground">{bs.singleBreakPct.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{bs.singleBreak} days</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">double break</p>
            <p className="text-lg font-semibold text-foreground">{bs.doubleBreakPct.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{bs.doubleBreak} days</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">no break</p>
            <p className="text-lg font-semibold text-foreground">{bs.noBreakPct.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{bs.noBreak} days</p>
          </div>
        </div>
      </div>

      <AITradingInsight
        mode="ib"
        symbol={symbol}
        analysisData={{
          totalDays: result.totalDays,
          insideDays: bs.noBreak,
          ibWindowMinutes: result.ibWindowMinutes,
          highFirst: { total: hf.total, breakHigh: hf.breakHigh, breakLow: hf.breakLow, inside: hf.inside },
          lowFirst: { total: lf.total, breakHigh: lf.breakHigh, breakLow: lf.breakLow, inside: lf.inside },
          breakTypeStats: bs,
          lastDay: result.lastDay ? {
            date: result.lastDay.date,
            ibHigh: result.lastDay.ibHigh,
            ibLow: result.lastDay.ibLow,
            highFirstFormed: result.lastDay.highFirstFormed,
            breakout: result.lastDay.breakout,
            breakType: result.lastDay.breakType,
          } : null,
        }}
      />
    </div>
  );
};

export default LondonIBDashboard;
