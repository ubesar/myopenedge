import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DetailedStats, formatCurrency, formatPercent } from '@/lib/analytics-helpers';

interface DetailedStatsPanelProps {
  stats: DetailedStats;
}

export function DetailedStatsPanel({ stats }: DetailedStatsPanelProps) {
  const items: { label: string; value: string; color?: string }[] = [
    { label: 'Total Trades', value: stats.totalTrades.toString() },
    { label: 'Profit Factor', value: stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? 'text-profit' : 'text-loss' },
    { label: 'Win Rate', value: formatPercent(stats.winRate), color: stats.winRate >= 50 ? 'text-profit' : 'text-loss' },
    { label: 'Expectancy', value: formatCurrency(stats.expectancy), color: stats.expectancy >= 0 ? 'text-profit' : 'text-loss' },
    { label: 'Max Drawdown', value: `${formatCurrency(stats.maxDrawdown)} (${formatPercent(stats.maxDrawdownPercent)})`, color: 'text-loss' },
    { label: 'Largest Win', value: formatCurrency(stats.largestWin), color: 'text-profit' },
    { label: 'Largest Loss', value: formatCurrency(stats.largestLoss), color: 'text-loss' },
    { label: 'Avg Trade', value: formatCurrency(stats.avgTrade), color: stats.avgTrade >= 0 ? 'text-profit' : 'text-loss' },
    { label: 'Green Days', value: `${stats.greenDays} / ${stats.totalDays}` },
    { label: 'Consistency', value: formatPercent(stats.consistencyScore), color: stats.consistencyScore >= 50 ? 'text-profit' : 'text-loss' },
  ];

  if (stats.avgSlTicks !== null) items.push({ label: 'Avg SL Ticks', value: stats.avgSlTicks.toFixed(1) });
  if (stats.avgTpTicks !== null) items.push({ label: 'Avg TP Ticks', value: stats.avgTpTicks.toFixed(1) });
  if (stats.avgRR !== null) items.push({ label: 'Avg R', value: `${stats.avgRR >= 0 ? '+' : ''}${stats.avgRR.toFixed(2)}R`, color: stats.avgRR >= 0 ? 'text-profit' : 'text-loss' });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Detailed Statistics</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/30">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className={cn('text-sm font-mono font-medium', item.color)}>{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
