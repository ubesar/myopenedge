import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DirectionStats as DirectionStatsType, formatPercent, formatCurrency } from '@/lib/analytics-helpers';

interface DirectionStatsProps {
  data: DirectionStatsType[];
}

export function DirectionStats({ data }: DirectionStatsProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Win Rate by Direction</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {data.map((item) => (
          <div key={item.direction} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={cn('font-medium', item.direction === 'LONG' ? 'text-profit' : 'text-loss')}>{item.direction}</span>
              <span className="text-muted-foreground">{item.trades} trades • {formatPercent(item.winRate)} WR</span>
            </div>
            <div className="h-6 bg-secondary/50 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', item.direction === 'LONG' ? 'bg-profit' : 'bg-loss')} style={{ width: `${item.winRate}%` }} />
            </div>
            <div className={cn('text-xs font-mono', item.netPnl >= 0 ? 'text-profit' : 'text-loss')}>
              {item.netPnl >= 0 ? '+' : ''}{formatCurrency(item.netPnl)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
