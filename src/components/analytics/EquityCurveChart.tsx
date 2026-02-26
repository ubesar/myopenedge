import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { EquityCurvePoint, formatCurrency } from '@/lib/analytics-helpers';

interface EquityCurveChartProps {
  data: EquityCurvePoint[];
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
  const isPositive = data.length > 0 && data[data.length - 1].cumulative >= 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Equity Curve</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), 'MMM d')} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={45} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [formatCurrency(value), 'Equity']} labelFormatter={(label) => format(parseISO(label), 'MMM d, yyyy')} />
              <Area type="monotone" dataKey="cumulative" stroke={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} strokeWidth={2} fill="url(#colorEquity)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
