import { ScrollArea } from "@/components/ui/scroll-area";

export interface ReportHistoryDay {
  date: string;
  label: string;       // e.g. "High First", "Low First", "Gap Up"
  result: string;       // e.g. "▲ High", "▼ Low", "Bullish", "Filled"
  resultColor: string;  // tailwind text color class
  bgClass: string;      // tailwind bg+border classes
  detail: string;       // e.g. "IB: 602.19 – 607.40"
}

interface AnalysisReportHistoryProps {
  title: string;
  days: ReportHistoryDay[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const AnalysisReportHistory = ({ title, days, selectedDate, onDateChange }: AnalysisReportHistoryProps) => {
  const reversed = [...days].reverse();

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md shadow-lg flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border/20">
        <h3 className="text-xs font-semibold text-card-foreground">📊 {title}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{days.length} trading days</p>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {reversed.map((day) => {
            const isSelected = day.date === selectedDate;
            return (
              <button
                key={day.date}
                onClick={() => onDateChange(day.date)}
                className={`w-full text-left rounded-md border px-2.5 py-1.5 transition-colors text-[11px] ${
                  isSelected
                    ? "ring-1 ring-primary border-primary/40 bg-primary/10"
                    : `${day.bgClass} hover:bg-muted/40`
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-card-foreground">{day.date}</span>
                  <span className={`font-semibold ${day.resultColor}`}>{day.result}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span>{day.label}</span>
                  <span>{day.detail}</span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AnalysisReportHistory;
