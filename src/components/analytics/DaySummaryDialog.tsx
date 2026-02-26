import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AnalyticsTrade, formatCurrency, calculateKPIs, generateEquityCurve } from '@/lib/analytics-helpers';
import { FileText, ArrowRight, Save, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface PlaybookInfo { id: string; name: string; tag?: string | null; }
interface Attachment { id: string; file_url: string; file_name: string | null; trade_id: string; }

interface DaySummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  trades: AnalyticsTrade[];
  playbooks: PlaybookInfo[];
}

export function DaySummaryDialog({ open, onOpenChange, date, trades, playbooks }: DaySummaryDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [originalNote, setOriginalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const dayTrades = date ? trades.filter(t => format(parseISO(t.close_time), 'yyyy-MM-dd') === date) : [];
  const kpis = calculateKPIs(dayTrades);
  const equityCurve = generateEquityCurve(dayTrades);

  const getPlaybookName = (playbookId: string | null) => {
    if (!playbookId) return '-';
    const pb = playbooks.find(p => p.id === playbookId);
    return pb ? pb.name : '-';
  };

  useEffect(() => {
    if (open && date) { fetchNote(); fetchAttachments(); }
    if (!open) { setShowNote(false); setNote(''); setOriginalNote(''); setAttachments([]); }
  }, [open, date]);

  const fetchNote = async () => {
    if (!date) return;
    setLoading(true);
    const { data } = await supabase.from('daily_notes').select('content').eq('date', date).maybeSingle();
    if (data) { setNote(data.content || ''); setOriginalNote(data.content || ''); }
    setLoading(false);
  };

  const fetchAttachments = async () => {
    if (!date || dayTrades.length === 0) return;
    const { data } = await supabase.from('attachments').select('id, file_url, file_name, trade_id').in('trade_id', dayTrades.map(t => t.id));
    if (data) setAttachments(data);
  };

  const handleSaveNote = async () => {
    if (!date) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('daily_notes').upsert({ user_id: user.id, date, content: note }, { onConflict: 'user_id,date' });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Saved' }); setOriginalNote(note); }
    setSaving(false);
  };

  const handleViewDetails = (tradeId: string) => { onOpenChange(false); navigate(`/journal/trades/${tradeId}`); };

  if (!date) return null;

  const formattedDate = format(parseISO(date), 'EEE, MMM d, yyyy');
  const hasUnsavedChanges = note !== originalNote;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-lg">{formattedDate}</DialogTitle>
              <span className={cn('font-mono font-semibold', kpis.netPnl >= 0 ? 'text-profit' : 'text-loss')}>
                {kpis.netPnl >= 0 ? '+' : ''}{formatCurrency(kpis.netPnl)}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowNote(!showNote)}>
              <FileText className="h-4 w-4 mr-2" />{showNote ? 'Hide Note' : 'View Note'}
            </Button>
          </div>
        </DialogHeader>

        {showNote && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Daily Note</h4>
                <div className="flex gap-2">
                  {hasUnsavedChanges && <Button size="sm" variant="ghost" onClick={() => setNote(originalNote)}><X className="h-4 w-4 mr-1" />Cancel</Button>}
                  <Button size="sm" onClick={handleSaveNote} disabled={saving || !hasUnsavedChanges}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save
                  </Button>
                </div>
              </div>
              <Textarea placeholder="Write your observations, lessons learned..." value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[120px] bg-background" />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Total Trades</p><p className="text-lg font-semibold">{kpis.totalTrades}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Winners</p><p className="text-lg font-semibold text-profit">{kpis.wins}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Losers</p><p className="text-lg font-semibold text-loss">{kpis.losses}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Win Rate</p><p className="text-lg font-semibold">{kpis.winRate.toFixed(0)}%</p></CardContent></Card>
        </div>

        {equityCurve.length > 0 && (
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--profit))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Area type="monotone" dataKey="cumulative" stroke="hsl(var(--profit))" fill="url(#colorCumulative)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <Separator />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Time</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Symbol</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Side</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Qty</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Net P&L</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Playbook</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">R</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {dayTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-border/30 hover:bg-muted/50">
                  <td className="py-2 text-xs">{format(parseISO(trade.close_time), 'HH:mm:ss')}</td>
                  <td className="py-2 font-mono font-medium">{trade.symbol}</td>
                  <td className="py-2"><Badge variant={trade.side === 'LONG' ? 'default' : 'destructive'} className="text-[10px] px-1.5">{trade.side}</Badge></td>
                  <td className="py-2 text-right text-muted-foreground">{trade.qty}</td>
                  <td className={cn('py-2 text-right font-mono font-medium', trade.pnl_net >= 0 ? 'text-profit' : 'text-loss')}>{trade.pnl_net >= 0 ? '+' : ''}{formatCurrency(trade.pnl_net)}</td>
                  <td className="py-2 text-xs text-muted-foreground truncate max-w-[100px]">{getPlaybookName(trade.playbook_id)}</td>
                  <td className={cn('py-2 text-right font-mono text-xs', trade.r_multiple !== null && trade.r_multiple >= 0 ? 'text-profit' : 'text-loss')}>
                    {trade.r_multiple !== null ? `${trade.r_multiple >= 0 ? '+' : ''}${trade.r_multiple.toFixed(2)}R` : '-'}
                  </td>
                  <td className="py-2"><Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleViewDetails(trade.id)}><ArrowRight className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {attachments.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" />Screenshots ({attachments.length})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {attachments.map((att) => (
                  <img key={att.id} src={att.file_url} alt={att.file_name || 'Screenshot'} className="w-full h-24 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(att.file_url, '_blank')} />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {dayTrades.length > 0 && <Button onClick={() => handleViewDetails(dayTrades[0].id)}>View Details</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
