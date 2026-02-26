import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/trading-data';
import { useToast } from '@/hooks/use-toast';
import { usePlaybooks } from '@/hooks/usePlaybooks';
import { useAccounts } from '@/hooks/useAccounts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DbTrade {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  entry_price: number;
  exit_price: number;
  open_time: string;
  close_time: string;
  pnl_net: number;
  r_multiple: number | null;
  notes: string | null;
  playbook_id: string | null;
  fees: number | null;
  session: string | null;
  account_id: string | null;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string | null;
}

export default function JournalTrades() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playbooks } = usePlaybooks();
  const { selectedAccountId } = useAccounts();
  const [searchQuery, setSearchQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [playbookFilter, setPlaybookFilter] = useState<string>('all');
  const [trades, setTrades] = useState<DbTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [viewingImages, setViewingImages] = useState<Attachment[] | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTrades();
  }, [selectedAccountId]);

  const fetchTrades = async () => {
    setLoading(true);
    let query = supabase
      .from('trades')
      .select('id, symbol, side, qty, entry_price, exit_price, open_time, close_time, pnl_net, r_multiple, notes, playbook_id, fees, session, account_id')
      .order('close_time', { ascending: false });
    if (selectedAccountId !== 'all') query = query.eq('account_id', selectedAccountId);
    const { data } = await query;
    if (data) {
      setTrades(data);
      const { data: attachData } = await supabase
        .from('attachments')
        .select('id, file_url, file_name, trade_id')
        .in('trade_id', data.map(t => t.id));
      if (attachData) {
        const grouped: Record<string, Attachment[]> = {};
        attachData.forEach((a: any) => {
          if (!grouped[a.trade_id]) grouped[a.trade_id] = [];
          grouped[a.trade_id].push({ id: a.id, file_url: a.file_url, file_name: a.file_name });
        });
        setAttachments(grouped);
      }
    }
    setLoading(false);
  };

  let filteredTrades = trades.filter((trade) =>
    trade.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (sideFilter !== 'all') {
    filteredTrades = filteredTrades.filter(t => t.side === sideFilter);
  }
  if (playbookFilter !== 'all') {
    filteredTrades = filteredTrades.filter(t => t.playbook_id === playbookFilter);
  }

  const handleUpload = async (tradeId: string, files: FileList) => {
    setUploadingId(tradeId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${tradeId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('trade-screenshots').upload(path, file);
      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }
      const { data: signedUrlData } = await supabase.storage.from('trade-screenshots').createSignedUrl(path, 60 * 60 * 24 * 7);
      const fileUrl = signedUrlData?.signedUrl || '';
      await supabase.from('attachments').insert({ trade_id: tradeId, user_id: user.id, file_url: fileUrl, file_name: file.name });
    }
    const { data: attachData } = await supabase
      .from('attachments')
      .select('id, file_url, file_name')
      .eq('trade_id', tradeId);
    if (attachData) {
      setAttachments(prev => ({ ...prev, [tradeId]: attachData }));
    }
    toast({ title: 'Uploaded' });
    setUploadingId(null);
  };

  if (loading) {
    return (
      <JournalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </JournalLayout>
    );
  }

  return (
    <JournalLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Trades</h1>
            <p className="text-sm text-muted-foreground">{filteredTrades.length} trades found</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/journal/import')}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by symbol..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Select value={sideFilter} onValueChange={setSideFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
                  <SelectValue placeholder="All Sides" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sides</SelectItem>
                  <SelectItem value="LONG">Long</SelectItem>
                  <SelectItem value="SHORT">Short</SelectItem>
                </SelectContent>
              </Select>
              <Select value={playbookFilter} onValueChange={setPlaybookFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                  <SelectValue placeholder="All Playbooks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Playbooks</SelectItem>
                  {playbooks.map((pb) => (
                    <SelectItem key={pb.id} value={pb.id}>{pb.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-3">
          {filteredTrades.map((trade) => {
            const tradeAttachments = attachments[trade.id] || [];
            return (
              <Card
                key={trade.id}
                onClick={() => navigate(`/journal/trades/${trade.id}`)}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium text-sm">{trade.symbol}</span>
                        <Badge variant={trade.side === 'LONG' ? 'default' : 'destructive'} className="text-xs">
                          {trade.side}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(trade.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {new Date(trade.close_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {trade.session && (
                        <Badge variant="secondary" className="text-xs mt-1">{trade.session}</Badge>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn('font-mono font-semibold text-sm', trade.pnl_net >= 0 ? 'text-profit' : 'text-loss')}>
                        {trade.pnl_net >= 0 ? '+' : ''}{formatCurrency(trade.pnl_net)}
                      </span>
                      {trade.r_multiple !== null && (
                        <div className={cn('text-xs font-mono', trade.r_multiple >= 0 ? 'text-profit' : 'text-loss')}>
                          {trade.r_multiple >= 0 ? '+' : ''}{trade.r_multiple.toFixed(1)}R
                        </div>
                      )}
                      {tradeAttachments.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <Eye className="h-3 w-3 inline mr-1" />{tradeAttachments.length}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden sm:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 md:p-4 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-3 md:p-4 text-xs font-medium text-muted-foreground">Symbol</th>
                  <th className="text-left p-3 md:p-4 text-xs font-medium text-muted-foreground">Side</th>
                  <th className="text-left p-3 md:p-4 text-xs font-medium text-muted-foreground hidden md:table-cell">Session</th>
                  <th className="text-left p-3 md:p-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">Playbook</th>
                  <th className="text-right p-3 md:p-4 text-xs font-medium text-muted-foreground">P&L</th>
                  <th className="text-center p-3 md:p-4 text-xs font-medium text-muted-foreground">R</th>
                  <th className="text-center p-3 md:p-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">Images</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => {
                  const tradeAttachments = attachments[trade.id] || [];
                  return (
                    <tr
                      key={trade.id}
                      onClick={() => navigate(`/journal/trades/${trade.id}`)}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <td className="p-3 md:p-4">
                        <div className="text-sm">{new Date(trade.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        <div className="text-xs text-muted-foreground">{new Date(trade.close_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="p-3 md:p-4"><span className="font-mono font-medium text-sm">{trade.symbol}</span></td>
                      <td className="p-3 md:p-4">
                        <Badge variant={trade.side === 'LONG' ? 'default' : 'destructive'} className="text-xs">{trade.side}</Badge>
                      </td>
                      <td className="p-3 md:p-4 hidden md:table-cell">
                        {trade.session && <Badge variant="secondary" className="text-xs">{trade.session}</Badge>}
                      </td>
                      <td className="p-3 md:p-4 hidden lg:table-cell">
                        {trade.playbook_id && (() => {
                          const pb = playbooks.find(p => p.id === trade.playbook_id);
                          return pb ? <span className="text-sm">{pb.name}</span> : null;
                        })()}
                      </td>
                      <td className="p-3 md:p-4 text-right">
                        <span className={cn('font-mono font-semibold text-sm', trade.pnl_net >= 0 ? 'text-profit' : 'text-loss')}>
                          {trade.pnl_net >= 0 ? '+' : ''}{formatCurrency(trade.pnl_net)}
                        </span>
                      </td>
                      <td className="p-3 md:p-4 text-center">
                        {trade.r_multiple !== null && (
                          <span className={cn('font-mono text-sm', trade.r_multiple >= 0 ? 'text-profit' : 'text-loss')}>
                            {trade.r_multiple >= 0 ? '+' : ''}{trade.r_multiple.toFixed(1)}R
                          </span>
                        )}
                      </td>
                      <td className="p-3 md:p-4 text-center hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                        {tradeAttachments.length > 0 ? (
                          <Button variant="ghost" size="sm" onClick={() => setViewingImages(tradeAttachments)} className="h-7 px-2">
                            <Eye className="h-3 w-3 mr-1" />{tradeAttachments.length}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-3 md:p-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Showing {filteredTrades.length} trades</p>
          </div>
        </Card>

        {filteredTrades.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-lg font-medium mb-1">No trades yet</p>
              <p className="text-sm">Import your trades or add them manually to get started.</p>
              <Button className="mt-4" onClick={() => navigate('/journal/import')}>
                <Upload className="h-4 w-4 mr-2" />
                Import Trades
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const tradeId = e.target.getAttribute('data-trade-id');
            if (tradeId && e.target.files) {
              handleUpload(tradeId, e.target.files);
            }
            e.target.value = '';
          }}
        />

        {/* Image viewer dialog */}
        <Dialog open={!!viewingImages} onOpenChange={() => setViewingImages(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Trade Images</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
              {viewingImages?.map((img) => (
                <div key={img.id} className="relative">
                  <img
                    src={img.file_url}
                    alt={img.file_name || 'Trade image'}
                    className="w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(img.file_url, '_blank')}
                  />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </JournalLayout>
  );
}
