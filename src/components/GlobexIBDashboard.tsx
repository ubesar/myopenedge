import ChartCard from "@/components/ChartCard";
import type { GlobexIBResult } from "@/lib/globex-ib-analysis";

interface GlobexIBDashboardProps {
  result: GlobexIBResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
}

const GlobexIBDashboard = ({ result, symbol, dateRange, weekdays }: GlobexIBDashboardProps) => {
  const hf = result.highFirst;
  const lf = result.lowFirst;
  const bs = result.globexIBBreakStats;
  const total = result.totalDays;

  return (
    <div className="space-y-4">
      {/* RTH breakout vs Globex range */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="globex IB high formed first"
          subtitle={`${symbol} · RTH breakout vs globex range`}
          totalDays={hf.total}
          bars={[
            { name: "RTH break globex high", value: hf.total > 0 ? (hf.breakHigh / hf.total * 100) : 0, color: "primary" },
            { name: "RTH break globex low", value: hf.total > 0 ? (hf.breakLow / hf.total * 100) : 0, color: "muted" },
          ]}
          legendItems={[
            { label: "RTH break globex high", color: "hsl(217,91%,60%)" },
            { label: "RTH break globex low", color: "hsl(240,5%,30%)" },
          ]}
          settingsGrid={[
            { label: "globex IB window", value: `${result.ibWindowMinutes} min` },
            { label: "globex session", value: "6:00 PM – 9:30 AM ET" },
            { label: "RTH breakout window", value: "9:30 AM – 12:00 PM" },
            { label: "breakout measure", value: "by rejection (M5 close)" },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />
        <ChartCard
          title="globex IB low formed first"
          subtitle={`${symbol} · RTH breakout vs globex range`}
          totalDays={lf.total}
          bars={[
            { name: "RTH break globex high", value: lf.total > 0 ? (lf.breakHigh / lf.total * 100) : 0, color: "primary" },
            { name: "RTH break globex low", value: lf.total > 0 ? (lf.breakLow / lf.total * 100) : 0, color: "muted" },
          ]}
          legendItems={[
            { label: "RTH break globex high", color: "hsl(217,91%,60%)" },
            { label: "RTH break globex low", color: "hsl(240,5%,30%)" },
          ]}
          settingsGrid={[
            { label: "globex IB window", value: `${result.ibWindowMinutes} min` },
            { label: "globex session", value: "6:00 PM – 9:30 AM ET" },
            { label: "RTH breakout window", value: "9:30 AM – 12:00 PM" },
            { label: "breakout measure", value: "by rejection (M5 close)" },
            { label: "date range", value: dateRange },
            { label: "weekdays", value: weekdays },
          ]}
        />
      </div>

      {/* Globex IB Break Stats */}
      <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4">
        <h3 className="text-[13px] font-semibold text-foreground mb-3 lowercase">
          overnight globex IB break statistics
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          did the overnight session break the globex IB range before RTH?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">broke high only</p>
            <p className="text-lg font-semibold text-foreground">
              {total > 0 ? Math.round((bs.brokeHigh / total) * 100) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">{bs.brokeHigh} days</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">broke low only</p>
            <p className="text-lg font-semibold text-foreground">
              {total > 0 ? Math.round((bs.brokeLow / total) * 100) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">{bs.brokeLow} days</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">broke both</p>
            <p className="text-lg font-semibold text-foreground">
              {total > 0 ? Math.round((bs.brokeBoth / total) * 100) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">{bs.brokeBoth} days</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">stayed inside</p>
            <p className="text-lg font-semibold text-foreground">
              {total > 0 ? Math.round((bs.stayedInside / total) * 100) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">{bs.stayedInside} days</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobexIBDashboard;
