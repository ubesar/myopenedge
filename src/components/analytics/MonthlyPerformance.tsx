import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { MonthlyPerformance as MonthlyPerformanceType, formatCurrency } from '@/lib/analytics-helpers';

interface MonthlyPerformanceProps {
  data: MonthlyPerformanceType[];
}

export function MonthlyPerformance({ data }: MonthlyPerformanceProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Monthly Performance</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tickFormatter={(v) => format(parseISO(v + '-01'), 'MMM')} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [formatCurrency(value), 'Net P&L']} labelFormatter={(label) => format(parseISO(label + '-01'), 'MMMM yyyy')} />
              <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.netPnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
