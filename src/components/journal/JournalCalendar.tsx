import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Trade {
  id: string;
  pnl_net: number;
  side: string;
  close_time: string;
  open_time: string;
  symbol: string;
}

interface JournalCalendarProps {
  trades: Trade[];
  onDayClick?: (date: string) => void;
}

const JournalCalendar = ({ trades, onDayClick }: JournalCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const dayMap = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    trades.forEach((t) => {
      const day = t.close_time.slice(0, 10);
      const existing = map.get(day) || { pnl: 0, count: 0 };
      map.set(day, { pnl: existing.pnl + t.pnl_net, count: existing.count + 1 });
    });
    return map;
  }, [trades]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        date: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({
        date: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // Weekly summaries
  const weeks = useMemo(() => {
    const result: { pnl: number; count: number }[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      const weekDays = calendarDays.slice(i, i + 7);
      let weekPnl = 0;
      let weekCount = 0;
      weekDays.forEach((d) => {
        const data = dayMap.get(d.date);
        if (data) {
          weekPnl += data.pnl;
          weekCount += data.count;
        }
      });
      result.push({ pnl: weekPnl, count: weekCount });
    }
    return result;
  }, [calendarDays, dayMap]);

  const fmt = (n: number) =>
    n >= 1000 || n <= -1000
      ? `${n >= 0 ? "+" : ""}$${(n / 1000).toFixed(1)}K`
      : `${n >= 0 ? "+" : ""}$${n.toFixed(0)}`;

  const today = new Date().toISOString().slice(0, 10);
  const monthName = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">📅 Calendar</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-[13px] font-medium text-foreground min-w-[130px] text-center">
            {monthName}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 gap-px">
        {/* Day headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Weekly"].map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}

        {/* Days + weekly summary */}
        {calendarDays.map((day, i) => {
          const data = dayMap.get(day.date);
          const isToday = day.date === today;
          const isWeekEnd = (i + 1) % 7 === 0;
          const weekIdx = Math.floor(i / 7);

          return (
            <>
              <button
                key={day.date}
                onClick={() => onDayClick?.(day.date)}
                className={`relative min-h-[70px] rounded-lg border transition-colors text-left p-2 ${
                  !day.isCurrentMonth
                    ? "border-transparent opacity-30"
                    : data
                    ? data.pnl >= 0
                      ? "border-green-500/30 bg-green-500/10 hover:bg-green-500/20"
                      : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                    : "border-border/50 hover:bg-accent/50"
                } ${isToday ? "ring-1 ring-primary" : ""}`}
              >
                <span
                  className={`text-[11px] font-medium ${
                    isToday ? "text-primary" : day.isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {day.day}
                </span>
                {data && day.isCurrentMonth && (
                  <div className="mt-1">
                    <p className={`text-[11px] font-bold ${data.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmt(data.pnl)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{data.count}t</p>
                  </div>
                )}
              </button>
              {/* Weekly summary after each Saturday */}
              {isWeekEnd && (
                <div
                  key={`week-${weekIdx}`}
                  className={`min-h-[70px] rounded-lg border p-2 flex flex-col justify-center items-center ${
                    weeks[weekIdx].count > 0
                      ? weeks[weekIdx].pnl >= 0
                        ? "border-green-500/30 bg-green-500/10"
                        : "border-red-500/30 bg-red-500/10"
                      : "border-border/50"
                  }`}
                >
                  {weeks[weekIdx].count > 0 ? (
                    <>
                      <p className={`text-[12px] font-bold ${weeks[weekIdx].pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {fmt(weeks[weekIdx].pnl)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{weeks[weekIdx].count} trades</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground">$0.00</p>
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

export default JournalCalendar;
