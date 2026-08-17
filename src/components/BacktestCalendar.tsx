import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CalendarTrade {
  date: string; // yyyy-MM-dd
  pnl: number;
}

interface Props {
  trades: CalendarTrade[];
  selected?: string | null;
  onDayClick?: (date: string) => void;
}

const BacktestCalendar = ({ trades, selected, onDayClick }: Props) => {
  const lastDate = useMemo(() => {
    if (!trades.length) return new Date();
    const max = trades.map((t) => t.date).sort().slice(-1)[0];
    return new Date(max + "T12:00:00");
  }, [trades]);

  const [currentDate, setCurrentDate] = useState(lastDate);
  const [anchor, setAnchor] = useState(lastDate.getTime());
  if (anchor !== lastDate.getTime()) {
    setAnchor(lastDate.getTime());
    setCurrentDate(lastDate);
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const dayMap = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    trades.forEach((t) => {
      const e = map.get(t.date) || { pnl: 0, count: 0 };
      map.set(t.date, { pnl: e.pnl + t.pnl, count: e.count + 1 });
    });
    return map;
  }, [trades]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      days.push({ date: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = month === 11 ? 0 : month + 1;
      const ny = month === 11 ? year + 1 : year;
      days.push({ date: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const weeks = useMemo(() => {
    const result: { pnl: number; count: number }[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      let pnl = 0;
      let count = 0;
      calendarDays.slice(i, i + 7).forEach((d) => {
        const data = dayMap.get(d.date);
        if (data) {
          pnl += data.pnl;
          count += data.count;
        }
      });
      result.push({ pnl, count });
    }
    return result;
  }, [calendarDays, dayMap]);

  const fmt = (n: number) =>
    n >= 1000 || n <= -1000
      ? `${n >= 0 ? "+" : ""}$${(n / 1000).toFixed(1)}K`
      : `${n >= 0 ? "+" : ""}$${n.toFixed(0)}`;

  const monthName = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground lowercase">calendar</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-accent transition-colors">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-[13px] font-medium text-foreground min-w-[130px] text-center">{monthName}</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-accent transition-colors">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-px">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Weekly"].map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-2">{d}</div>
        ))}

        {calendarDays.map((day, i) => {
          const data = dayMap.get(day.date);
          const isWeekEnd = (i + 1) % 7 === 0;
          const weekIdx = Math.floor(i / 7);
          return (
            <>
              <button
                key={day.date}
                onClick={() => data && onDayClick?.(day.date)}
                className={`relative min-h-[64px] rounded-lg border transition-colors text-left p-2 ${
                  !day.isCurrentMonth
                    ? "border-transparent opacity-30"
                    : data
                    ? data.pnl >= 0
                      ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                      : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                    : "border-border/50"
                } ${selected === day.date ? "ring-1 ring-primary" : ""}`}
              >
                <span className={`text-[11px] font-medium ${day.isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                  {day.day}
                </span>
                {data && day.isCurrentMonth && (
                  <div className="mt-1">
                    <p className={`text-[11px] font-bold ${data.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(data.pnl)}</p>
                    <p className="text-[9px] text-muted-foreground">{data.count}t</p>
                  </div>
                )}
              </button>
              {isWeekEnd && (
                <div
                  key={`week-${weekIdx}`}
                  className={`min-h-[64px] rounded-lg border p-2 flex flex-col justify-center items-center ${
                    weeks[weekIdx].count > 0
                      ? weeks[weekIdx].pnl >= 0
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-red-500/30 bg-red-500/10"
                      : "border-border/50"
                  }`}
                >
                  {weeks[weekIdx].count > 0 ? (
                    <>
                      <p className={`text-[12px] font-bold ${weeks[weekIdx].pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmt(weeks[weekIdx].pnl)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{weeks[weekIdx].count} trades</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground">$0</p>
                      <p className="text-[9px] text-muted-foreground">0 trades</p>
                    </>
                  )}
                </div>
              )}
            </>
          );
        })}
      </div>
    </div>
  );
};

export default BacktestCalendar;
