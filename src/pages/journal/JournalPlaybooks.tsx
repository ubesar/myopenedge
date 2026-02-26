import { useState, useEffect } from 'react';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { usePlaybooks } from '@/hooks/usePlaybooks';
import { supabase } from '@/integrations/supabase/client';
import { Playbook, PlaybookWithStats } from '@/types/playbook';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/trading-data';
import { Plus, Edit2, Trash2, BookOpen, TrendingUp, Target, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function JournalPlaybooks() {
  const { playbooks, loading, createPlaybook, updatePlaybook, deletePlaybook, refetch } = usePlaybooks();
  const [playbookStats, setPlaybookStats] = useState<Record<string, { trades_count: number; net_pnl: number; win_rate: number }>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [deleting, setDeleting] = useState<Playbook | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Fetch trade stats per playbook
  useEffect(() => {
    const fetchStats = async () => {
      const { data: trades } = await supabase.from('trades').select('playbook_id, pnl_net');
      if (!trades) return;

      const stats: Record<string, { trades_count: number; net_pnl: number; wins: number }> = {};
      trades.forEach((t) => {
        if (!t.playbook_id) return;
        if (!stats[t.playbook_id]) stats[t.playbook_id] = { trades_count: 0, net_pnl: 0, wins: 0 };
        stats[t.playbook_id].trades_count++;
        stats[t.playbook_id].net_pnl += Number(t.pnl_net);
        if (Number(t.pnl_net) > 0) stats[t.playbook_id].wins++;
      });

      const result: typeof playbookStats = {};
      Object.entries(stats).forEach(([id, s]) => {
        result[id] = { trades_count: s.trades_count, net_pnl: s.net_pnl, win_rate: s.trades_count > 0 ? (s.wins / s.trades_count) * 100 : 0 };
      });
      setPlaybookStats(result);
    };
    fetchStats();
  }, [playbooks]);

  const openCreate = () => {
    setEditing(null);
    setName(''); setTag(''); setDescription(''); setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (pb: Playbook) => {
    setEditing(pb);
    setName(pb.name); setTag(pb.tag || ''); setDescription(pb.description || ''); setIsActive(pb.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updatePlaybook(editing.id, { name: name.trim(), tag: tag.trim() || null, description: description.trim() || null, is_active: isActive });
        toast.success('Playbook updated');
      } else {
        await createPlaybook({ name: name.trim(), tag: tag.trim() || null, description: description.trim() || null, is_active: isActive });
        toast.success('Playbook created');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deletePlaybook(deleting.id);
      toast.success('Playbook deleted');
      setDeleteDialogOpen(false);
      setDeleting(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  if (loading) return <JournalLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></JournalLayout>;

  return (
    <JournalLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Playbooks</h1>
            <p className="text-sm text-muted-foreground">Manage your trading strategies</p>
          </div>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />New Playbook</Button>
        </div>

        {playbooks.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No Playbooks Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first playbook to start categorizing your trades by strategy.</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Create Playbook</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {playbooks.map((pb) => {
              const stats = playbookStats[pb.id] || { trades_count: 0, net_pnl: 0, win_rate: 0 };
              return (
                <Card key={pb.id} className={cn('transition-all hover:border-primary/30', !pb.is_active && 'opacity-60')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base truncate">{pb.name}</CardTitle>
                          {!pb.is_active && <Badge variant="secondary" className="text-xs shrink-0">Inactive</Badge>}
                        </div>
                        {pb.tag && <Badge variant="outline" className="text-xs">{pb.tag}</Badge>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(pb)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleting(pb); setDeleteDialogOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pb.description && <p className="text-sm text-muted-foreground line-clamp-2">{pb.description}</p>}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">Trades</p>
                        <p className="font-mono font-semibold">{stats.trades_count}</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">Net P&L</p>
                        <p className={cn('font-mono font-semibold', stats.net_pnl >= 0 ? 'text-profit' : 'text-loss')}>
                          {formatCurrency(stats.net_pnl)}
                        </p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className={cn('font-mono font-semibold', stats.win_rate >= 50 ? 'text-profit' : 'text-loss')}>
                          {stats.trades_count > 0 ? formatPercent(stats.win_rate) : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Playbook' : 'New Playbook'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update your trading strategy details.' : 'Define a new trading strategy to track performance.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pb-name">Name *</Label>
              <Input id="pb-name" placeholder="e.g. Opening Range Breakout" value={name} onChange={e => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pb-tag">Tag</Label>
              <Input id="pb-tag" placeholder="e.g. ORB, Momentum, Scalp" value={tag} onChange={e => setTag(e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pb-desc">Description</Label>
              <Textarea id="pb-desc" placeholder="Describe entry/exit rules, conditions, etc." value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={1000} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pb-active">Active</Label>
              <Switch id="pb-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Playbook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleting?.name}"? Trades linked to this playbook will not be deleted, but they will lose their playbook assignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </JournalLayout>
  );
}
