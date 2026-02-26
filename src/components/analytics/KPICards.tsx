import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Target, Scale, DollarSign, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KPIStats, formatCurrency, formatPercent } from '@/lib/analytics-helpers';

interface KPICardsProps {
  stats: KPIStats;
}

export function KPICards({ stats }: KPICardsProps) {
  const cards = [
    { title: 'Net P&L', value: formatCurrency(stats.netPnl), icon: DollarSign, color: stats.netPnl >= 0 ? 'text-profit' : 'text-loss' },
    { title: 'Win Rate', value: formatPercent(stats.winRate), subtitle: `${stats.wins}W / ${stats.losses}L`, icon: Target, color: stats.winRate >= 50 ? 'text-profit' : 'text-loss' },
    { title: 'Profit Factor', value: stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), icon: TrendingUp, color: stats.profitFactor >= 1 ? 'text-profit' : 'text-loss' },
    { title: 'Avg Win / Loss', value: `${formatCurrency(stats.avgWin)} / ${formatCurrency(stats.avgLoss)}`, subtitle: stats.winLossRatio === Infinity ? '∞' : `${stats.winLossRatio.toFixed(2)}:1`, icon: Scale },
    { title: 'Streak', value: stats.currentStreak.type === 'none' ? '—' : `${stats.currentStreak.type}${stats.currentStreak.count}`, icon: Flame, color: stats.currentStreak.type === 'W' ? 'text-profit' : stats.currentStreak.type === 'L' ? 'text-loss' : 'text-muted-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/50">
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-start justify-between gap-1">
              <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{card.title}</p>
                <p className={cn('text-sm sm:text-xl font-bold font-mono truncate', card.color)}>{card.value}</p>
                {card.subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{card.subtitle}</p>}
              </div>
              <card.icon className={cn('h-3 w-3 sm:h-4 sm:w-4 shrink-0', card.color || 'text-muted-foreground')} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
