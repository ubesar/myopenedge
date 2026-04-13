import type { LastDayData } from "@/lib/ib-analysis";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IBReportHistoryProps {
  allDays: LastDayData[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  symbol: string;
}

const IBReportHistory = ({ allDays, selectedDate, onDateChange, symbol }: IBReportHistoryProps) => {
  const reversed = [...allDays].reverse();

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md shadow-lg flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border/20">
        <h3 className="text-xs font-semibold text-card-foreground">📊 Report History — {symbol}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{allDays.length} trading days</p>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {reversed.map((day) => {
            const isSelected = day.date === selectedDate;
            const breakoutColor =
              day.breakout === "high"
                ? "text-emerald-400"
                : day.breakout === "low"
                ? "text-red-400"
                : "text-muted-foreground";
            const breakoutBg =
              day.breakout === "high"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : day.breakout === "low"
                ? "bg-red-500/10 border-red-500/20"
                : "bg-muted/30 border-border/20";

            return (
              <button
                key={day.date}
                onClick={() => onDateChange(day.date)}
                className={`w-full text-left rounded-md border px-2.5 py-1.5 transition-colors text-[11px] ${
                  isSelected
                    ? "ring-1 ring-primary border-primary/40 bg-primary/10"
                    : `${breakoutBg} hover:bg-muted/40`
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-card-foreground">{day.date}</span>
                  <span className={`font-semibold ${breakoutColor}`}>
                    {day.breakout === "high" ? "▲ High" : day.breakout === "low" ? "▼ Low" : "⚪ Inside"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span>{day.highFirstFormed ? "High First" : "Low First"}</span>
                  <span>IB: {day.ibLow.toFixed(2)} – {day.ibHigh.toFixed(2)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default IBReportHistory;
