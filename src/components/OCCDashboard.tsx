import ChartCard from "@/components/ChartCard";
import type { OCCResult, OCCCandleSize } from "@/lib/occ-analysis";

interface OCCDashboardProps {
  result: OCCResult;
  symbol: string;
  dateRange: string;
  weekdays: string;
  candleSize: OCCCandleSize;
  onCandleSizeChange: (size: OCCCandleSize) => void;
}

const CANDLE_SIZES: { value: OCCCandleSize; label: string }[] = [
  { value: "5m", label: "5min" },
  { value: "15m", label: "15min" },
  { value: "30m", label: "30min" },
  { value: "1h", label: "1hour" },
];

const OCCDashboard = ({ result, symbol, dateRange, weekdays, candleSize, onCandleSizeChange }: OCCDashboardProps) => {
  const { greenCandle, redCandle } = result;

  const sharedSettings = [
    { label: "opening candle size", value: candleSize },
    { label: "session", value: "09:30 AM – 04:00 PM" },
    { label: "breakout measure", value: "daily close vs daily open" },
    { label: "date range", value: dateRange },
    { label: "weekdays", value: weekdays },
  ];

  return (
    <div className="space-y-4">
      {/* Two ChartCards side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="green opening candle"
          subtitle={`${symbol} · continuation vs reversal`}
          totalDays={greenCandle.total}
          bars={[
            { name: "continuation (green day)", value: greenCandle.greenDayPct, color: "primary" },
            { name: "reversal (red day)", value: greenCandle.redDayPct, color: "muted" },
          ]}
          legendItems={[
            { label: "continuation (green day)", color: "hsl(var(--chart-bar-a))" },
            { label: "reversal (red day)", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={sharedSettings}
        />
        <ChartCard
          title="red opening candle"
          subtitle={`${symbol} · continuation vs reversal`}
          totalDays={redCandle.total}
          bars={[
            { name: "continuation (red day)", value: redCandle.redDayPct, color: "primary" },
            { name: "reversal (green day)", value: redCandle.greenDayPct, color: "muted" },
          ]}
          legendItems={[
            { label: "continuation (red day)", color: "hsl(var(--chart-bar-a))" },
            { label: "reversal (green day)", color: "hsl(var(--chart-bar-b))" },
          ]}
          settingsGrid={sharedSettings}
        />
      </div>

      {/* Candle size selector */}
      <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">change opening candle size</span>
        <div className="flex gap-1.5 mt-2">
          {CANDLE_SIZES.map((cs) => (
            <button
              key={cs.value}
              onClick={() => onCandleSizeChange(cs.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                candleSize === cs.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cs.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OCCDashboard;
