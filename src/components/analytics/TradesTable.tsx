import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { AnalyticsTrade, formatCurrency } from '@/lib/analytics-helpers';

interface PlaybookInfo { id: string; name: string; tag?: string | null; }

interface TradesTableProps {
  trades: AnalyticsTrade[];
  selectedDate: string | null;
  playbooks?: PlaybookInfo[];
}

export function TradesTable({ trades, selectedDate, playbooks = [] }: TradesTableProps) {
  const getPlaybookName = (playbookId: string | null) => {
    if (!playbookId) return '-';
    const pb = playbooks.find(p => p.id === playbookId);
    return pb ? pb.name : '-';
  };
  const [page, setPage] = useState(0);
  const [selectedTrade, setSelectedTrade] = useState<AnalyticsTrade | null>(null);
  const pageSize = 10;

  const filteredTrades = selectedDate
    ? trades.filter(t => format(parseISO(t.close_time), 'yyyy-MM-dd') === selectedDate)
    : trades;

  const sortedTrades = [...filteredTrades].sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime());
  const totalPages = Math.ceil(sortedTrades.length / pageSize);
  const paginatedTrades = sortedTrades.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Trades {selectedDate && `(${format(parseISO(selectedDate), 'MMM d, yyyy')})`}
            </CardTitle>
            <span className="text-xs text-muted-foreground">{sortedTrades.length} trades</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground">Exit Date</th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground">Symbol</th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground">Dir</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground">Net P&L</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground">Fees</th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground">Playbook</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelectedTrade(trade)}>
                    <td className="py-2">
                      <div className="text-xs">{format(parseISO(trade.close_time), 'MMM d')}</div>
                      <div className="text-[10px] text-muted-foreground">{format(parseISO(trade.close_time), 'HH:mm')}</div>
                    </td>
                    <td className="py-2 font-mono font-medium">{trade.symbol}</td>
                    <td className="py-2">
                      <Badge variant={trade.side === 'LONG' ? 'default' : 'destructive'} className="text-[10px] px-1.5">{trade.side}</Badge>
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{trade.qty}</td>
                    <td className={cn('py-2 text-right font-mono font-medium', trade.pnl_net >= 0 ? 'text-profit' : 'text-loss')}>
                      {trade.pnl_net >= 0 ? '+' : ''}{formatCurrency(trade.pnl_net)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground font-mono">${(trade.fees || 0).toFixed(2)}</td>
                    <td className="py-2 text-xs text-muted-foreground truncate max-w-[100px]">{getPlaybookName(trade.playbook_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedTrades.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">No trades found</div>}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="font-mono">{selectedTrade?.symbol}</span>
              {selectedTrade && <Badge variant={selectedTrade.side === 'LONG' ? 'default' : 'destructive'}>{selectedTrade.side}</Badge>}
            </SheetTitle>
          </SheetHeader>
          {selectedTrade && (
            <div className="mt-6 space-y-6">
              <div className={cn('text-3xl font-bold font-mono', selectedTrade.pnl_net >= 0 ? 'text-profit' : 'text-loss')}>
                {selectedTrade.pnl_net >= 0 ? '+' : ''}{formatCurrency(selectedTrade.pnl_net)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Entry Time</p><p className="font-mono text-sm">{format(parseISO(selectedTrade.open_time), 'MMM d, yyyy HH:mm')}</p></div>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Exit Time</p><p className="font-mono text-sm">{format(parseISO(selectedTrade.close_time), 'MMM d, yyyy HH:mm')}</p></div>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Quantity</p><p className="font-mono text-sm">{selectedTrade.qty}</p></div>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Gross P&L</p><p className={cn('font-mono text-sm', selectedTrade.pnl_gross >= 0 ? 'text-profit' : 'text-loss')}>{selectedTrade.pnl_gross >= 0 ? '+' : ''}{formatCurrency(selectedTrade.pnl_gross)}</p></div>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Fees</p><p className="font-mono text-sm">${(selectedTrade.fees || 0).toFixed(2)}</p></div>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Playbook</p><p className="text-sm">{getPlaybookName(selectedTrade.playbook_id)}</p></div>
                {selectedTrade.r_multiple !== null && <div className="space-y-1"><p className="text-xs text-muted-foreground">R Multiple</p><p className={cn('font-mono text-sm', selectedTrade.r_multiple >= 0 ? 'text-profit' : 'text-loss')}>{selectedTrade.r_multiple >= 0 ? '+' : ''}{selectedTrade.r_multiple.toFixed(2)}R</p></div>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
