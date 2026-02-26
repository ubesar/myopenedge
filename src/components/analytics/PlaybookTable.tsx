import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PlaybookRow, formatCurrency, formatPercent } from '@/lib/analytics-helpers';

interface PlaybookTableProps {
  data: PlaybookRow[];
}

export function PlaybookTable({ data }: PlaybookTableProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Playbook Performance</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Playbook</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Trades</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">WR</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Net P&L</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">PF</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Avg R</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 5).map((row) => (
                <tr key={row.playbook_id || row.playbook} className="border-b border-border/30">
                  <td className="py-2 font-medium">{row.playbook}</td>
                  <td className="py-2 text-right text-muted-foreground">{row.trades}</td>
                  <td className={cn('py-2 text-right font-mono', row.winRate >= 50 ? 'text-profit' : 'text-loss')}>{formatPercent(row.winRate)}</td>
                  <td className={cn('py-2 text-right font-mono font-medium', row.netPnl >= 0 ? 'text-profit' : 'text-loss')}>{row.netPnl >= 0 ? '+' : ''}{formatCurrency(row.netPnl)}</td>
                  <td className={cn('py-2 text-right font-mono', row.profitFactor >= 1 ? 'text-profit' : 'text-loss')}>{row.profitFactor === Infinity ? '∞' : row.profitFactor.toFixed(2)}</td>
                  <td className={cn('py-2 text-right font-mono', (row.avgR || 0) >= 0 ? 'text-profit' : 'text-loss')}>{row.avgR !== null ? `${row.avgR >= 0 ? '+' : ''}${row.avgR.toFixed(2)}R` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <div className="text-center text-muted-foreground py-4 text-sm">No playbook data available</div>}
        </div>
      </CardContent>
    </Card>
  );
}
