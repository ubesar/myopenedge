import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarDay, formatCurrency } from '@/lib/analytics-helpers';

interface TradingCalendarProps {
  data: CalendarDay[];
  onDayClick: (date: string) => void;
  selectedDate: string | null;
}

export function TradingCalendar({ data, onDayClick, selectedDate }: TradingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDayData = (date: Date): CalendarDay | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return data.find(d => d.date === dateStr);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthData = data.filter(d => isSameMonth(new Date(d.date), currentMonth));
  const monthTotal = monthData.reduce((sum, d) => sum + d.netPnl, 0);
  const monthTrades = monthData.reduce((sum, d) => sum + d.trades, 0);

  const formatPnL = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return `$${Math.round(value)}`;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentMonth(new Date())}>TODAY</Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <span className="text-base font-semibold">{format(currentMonth, 'MMMM yyyy')}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={cn('text-lg font-bold font-mono', monthTotal >= 0 ? 'text-profit' : 'text-loss')}>
              {monthTotal >= 0 ? '+' : ''}{formatCurrency(monthTotal)}
            </span>
            <span className="text-sm text-muted-foreground">{monthTrades} trades</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2 border-b border-border">{day}</div>
          ))}
          {calendarDays.map((day, idx) => {
            const dayData = getDayData(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, new Date(selectedDate));
            const isTodayDate = isToday(day);
            const dateStr = format(day, 'yyyy-MM-dd');
            const isProfit = dayData && dayData.netPnl >= 0;

            return (
              <button
                key={idx}
                onClick={() => dayData && onDayClick(dateStr)}
                disabled={!dayData && !isCurrentMonth}
                className={cn(
                  'min-h-[60px] sm:min-h-[80px] p-1.5 sm:p-2 rounded-lg transition-all relative border',
                  isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/30',
                  !dayData && 'border-transparent',
                  dayData && isProfit && 'bg-profit/10 border-profit/30 hover:bg-profit/20',
                  dayData && !isProfit && 'bg-loss/10 border-loss/30 hover:bg-loss/20',
                  dayData && 'cursor-pointer',
                  isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  isTodayDate && !dayData && 'border-primary/50',
                  !dayData && isCurrentMonth && 'hover:bg-muted/50 border-border/50'
                )}
              >
                <div className={cn('absolute top-1.5 right-2 text-xs sm:text-sm', isTodayDate && 'font-bold text-primary', !isCurrentMonth && 'opacity-30')}>
                  {format(day, 'd')}
                </div>
                {dayData && (
                  <div className="flex flex-col items-center justify-center h-full pt-3">
                    <div className={cn('text-sm sm:text-xl font-bold font-mono', isProfit ? 'text-profit' : 'text-loss')}>
                      {isProfit ? '' : '-'}{formatPnL(Math.abs(dayData.netPnl))}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      {dayData.trades} {dayData.trades === 1 ? 'trade' : 'trades'}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
