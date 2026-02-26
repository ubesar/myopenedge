import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { EquityCurvePoint, formatCurrency } from '@/lib/analytics-helpers';

interface DailyPnLChartProps {
  data: EquityCurvePoint[];
}

export function DailyPnLChart({ data }: DailyPnLChartProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Daily Net P&L</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), 'd')} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `$${v}`} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={45} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [formatCurrency(value), 'Daily P&L']} labelFormatter={(label) => format(parseISO(label), 'MMM d, yyyy')} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="dailyNet" radius={[2, 2, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.dailyNet >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
