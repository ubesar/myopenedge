import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/trading-data';
import { usePlaybooks } from '@/hooks/usePlaybooks';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  Trash2,
  Image,
  Upload,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  entry_price: number;
  exit_price: number;
  open_time: string;
  close_time: string;
  pnl_gross: number;
  fees: number;
  pnl_net: number;
  r_multiple: number | null;
  session: string | null;
  playbook_id: string | null;
  notes: string | null;
  source: string;
  confidence_score: number | null;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string | null;
  created_at: string;
}

export default function JournalTradeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playbooks } = usePlaybooks();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editedNotes, setEditedNotes] = useState('');
  const [editedPlaybookId, setEditedPlaybookId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchTrade();
      fetchAttachments();
    }
  }, [id]);

  const fetchTrade = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Error', description: 'Trade not found', variant: 'destructive' });
      navigate('/journal/trades');
      return;
    }

    setTrade(data as Trade);
    setEditedNotes(data.notes || '');
    setEditedPlaybookId(data.playbook_id);
    setLoading(false);
  };

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from('attachments')
      .select('*')
      .eq('trade_id', id)
      .order('created_at', { ascending: false });
    if (data) setAttachments(data as Attachment[]);
  };

  const handleSave = async () => {
    if (!trade) return;
    setSaving(true);
    const { error } = await supabase
      .from('trades')
      .update({ notes: editedNotes || null, playbook_id: editedPlaybookId })
      .eq('id', trade.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } else {
      toast({ title: 'Saved' });
      setTrade({ ...trade, notes: editedNotes, playbook_id: editedPlaybookId });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!trade || !confirm('Are you sure you want to delete this trade?')) return;
    setDeleting(true);
    const { error } = await supabase.from('trades').delete().eq('id', trade.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
      setDeleting(false);
    } else {
      toast({ title: 'Deleted' });
      navigate('/journal/trades');
    }
  };

  const handleUploadAttachment = async (files: FileList) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('trade-screenshots').upload(path, file);
      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }
      const { data: signedUrlData } = await supabase.storage.from('trade-screenshots').createSignedUrl(path, 60 * 60 * 24 * 7);
      const fileUrl = signedUrlData?.signedUrl || '';
      await supabase.from('attachments').insert({ trade_id: id, user_id: user.id, file_url: fileUrl, file_name: file.name, file_type: file.type });
    }
    fetchAttachments();
    toast({ title: 'Uploaded' });
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

  if (!trade) return null;

  const isWinner = trade.pnl_net >= 0;

  return (
    <JournalLayout>
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/journal/trades')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold font-mono">{trade.symbol}</h1>
                <Badge variant={trade.side === 'LONG' ? 'default' : 'destructive'} className="text-xs sm:text-sm">
                  {trade.side}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {new Date(trade.close_time).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-12 sm:ml-0">
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 sm:mr-1" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>

        {/* P&L Card */}
        <Card className={cn('border-l-4', isWinner ? 'border-l-green-500' : 'border-l-red-500')}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Net P&L</p>
                <p className={cn('text-2xl sm:text-4xl font-bold font-mono', isWinner ? 'text-profit' : 'text-loss')}>
                  {isWinner ? '+' : ''}{formatCurrency(trade.pnl_net)}
                </p>
              </div>
              <div className={cn('h-12 w-12 sm:h-16 sm:w-16 rounded-xl flex items-center justify-center', isWinner ? 'bg-green-500/20' : 'bg-red-500/20')}>
                {isWinner ? <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-profit" /> : <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-loss" />}
              </div>
            </div>
            {trade.r_multiple !== null && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <span className="text-xs sm:text-sm text-muted-foreground">R-Multiple: </span>
                <span className={cn('font-mono font-semibold', trade.r_multiple >= 0 ? 'text-profit' : 'text-loss')}>
                  {trade.r_multiple >= 0 ? '+' : ''}{trade.r_multiple.toFixed(2)}R
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trade Details + Playbook */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Trade Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Entry Price</p>
                  <p className="font-mono text-sm">{trade.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Exit Price</p>
                  <p className="font-mono text-sm">{trade.exit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Quantity</p>
                  <p className="font-mono text-sm">{trade.qty}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Fees</p>
                  <p className="font-mono text-sm text-loss">{formatCurrency(trade.fees)}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Open Time</p>
                    <p className="text-sm">{new Date(trade.open_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Close Time</p>
                    <p className="text-sm">{new Date(trade.close_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
              {trade.session && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Session</p>
                  <Badge variant="secondary" className="text-xs">{trade.session}</Badge>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Source</p>
                <Badge variant="secondary" className="text-xs">{trade.source}</Badge>
                {trade.confidence_score !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">({(trade.confidence_score * 100).toFixed(0)}% confidence)</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Playbook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Assign Playbook</Label>
                <Select value={editedPlaybookId || 'none'} onValueChange={(v) => setEditedPlaybookId(v === 'none' ? null : v)}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select playbook..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {playbooks.map((pb) => (
                      <SelectItem key={pb.id} value={pb.id}>
                        <div className="flex items-center gap-2">
                          <span>{pb.name}</span>
                          {pb.tag && <Badge variant="secondary" className="text-xs">{pb.tag}</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editedPlaybookId && (() => {
                const pb = playbooks.find(p => p.id === editedPlaybookId);
                return pb?.description ? (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">{pb.description}</p>
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Trade Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Write your thoughts about this trade..."
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              className="min-h-[100px] sm:min-h-[150px] text-sm"
            />
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm sm:text-base">Attachments</CardTitle>
              <div>
                <input
                  type="file"
                  id="attachment-upload"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUploadAttachment(e.target.files);
                    }
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('attachment-upload')?.click()}>
                  <Upload className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Upload</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {attachments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Image className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No attachments yet</p>
                <p className="text-xs">Upload screenshots or charts related to this trade</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="relative group">
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name || 'Attachment'}
                      className="w-full max-h-[500px] object-contain rounded-lg border border-border bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(attachment.file_url, '_blank')}
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs bg-background/90 hover:bg-background shadow-md"
                        onClick={() => window.open(attachment.file_url, '_blank')}
                      >
                        Full Size
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2 bg-background/90 hover:bg-destructive hover:text-destructive-foreground shadow-md"
                        onClick={async () => {
                          if (!confirm('Delete this attachment?')) return;
                          await supabase.from('attachments').delete().eq('id', attachment.id);
                          fetchAttachments();
                          toast({ title: 'Deleted' });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {attachment.file_name && (
                      <p className="text-xs text-muted-foreground mt-2">{attachment.file_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </JournalLayout>
  );
}
