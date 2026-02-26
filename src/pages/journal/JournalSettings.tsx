import { useState, useEffect } from 'react';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/trading-data';
import { Plus, Edit2, Trash2, Star, Building2, User, Loader2, Shield, Target, TrendingDown, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface Account {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  currency: string | null;
  timezone: string | null;
  is_default: boolean | null;
  created_at: string;
  starting_balance: number | null;
  max_loss_limit: number | null;
  profit_target: number | null;
  consistency_enabled: boolean | null;
  consistency_percent: number | null;
  daily_loss_limit_enabled: boolean | null;
  daily_loss_limit: number | null;
  account_type: string | null;
  status: string | null;
}

const ACCOUNT_TYPES = [
  { value: 'personal', label: 'Personal', icon: User },
  { value: 'propfirm_eval', label: 'Prop Firm — Evaluation', icon: Target },
  { value: 'propfirm_funded', label: 'Prop Firm — Funded', icon: Building2 },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Jakarta', 'Australia/Sydney',
];

export default function JournalSettings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', broker: '', currency: 'USD', timezone: 'America/New_York',
    account_type: 'personal', starting_balance: '',
    max_loss_limit: '', profit_target: '',
    consistency_enabled: false, consistency_percent: '',
    daily_loss_limit_enabled: false, daily_loss_limit: '',
  });

  // Trade stats per account
  const [accountStats, setAccountStats] = useState<Record<string, { trades: number; pnl: number }>>({});

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').order('is_default', { ascending: false }).order('created_at');
    if (data) setAccounts(data as unknown as Account[]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data: trades } = await supabase.from('trades').select('account_id, pnl_net');
    if (!trades) return;
    const stats: Record<string, { trades: number; pnl: number }> = {};
    trades.forEach(t => {
      if (!t.account_id) return;
      if (!stats[t.account_id]) stats[t.account_id] = { trades: 0, pnl: 0 };
      stats[t.account_id].trades++;
      stats[t.account_id].pnl += Number(t.pnl_net);
    });
    setAccountStats(stats);
  };

  useEffect(() => { fetchAccounts(); fetchStats(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', broker: '', currency: 'USD', timezone: 'America/New_York', account_type: 'personal', starting_balance: '', max_loss_limit: '', profit_target: '', consistency_enabled: false, consistency_percent: '', daily_loss_limit_enabled: false, daily_loss_limit: '' });
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({
      name: acc.name, broker: acc.broker || '', currency: acc.currency || 'USD',
      timezone: acc.timezone || 'America/New_York', account_type: acc.account_type || 'personal',
      starting_balance: acc.starting_balance?.toString() || '',
      max_loss_limit: acc.max_loss_limit?.toString() || '',
      profit_target: acc.profit_target?.toString() || '',
      consistency_enabled: acc.consistency_enabled || false,
      consistency_percent: acc.consistency_percent?.toString() || '',
      daily_loss_limit_enabled: acc.daily_loss_limit_enabled || false,
      daily_loss_limit: acc.daily_loss_limit?.toString() || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Account name is required'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setSaving(false); return; }

    const payload = {
      name: form.name.trim(),
      broker: form.broker.trim() || null,
      currency: form.currency,
      timezone: form.timezone,
      account_type: form.account_type,
      starting_balance: form.starting_balance ? parseFloat(form.starting_balance) : 0,
      max_loss_limit: form.max_loss_limit ? parseFloat(form.max_loss_limit) : null,
      profit_target: form.profit_target ? parseFloat(form.profit_target) : null,
      consistency_enabled: form.consistency_enabled,
      consistency_percent: form.consistency_enabled && form.consistency_percent ? parseFloat(form.consistency_percent) : null,
      daily_loss_limit_enabled: form.daily_loss_limit_enabled,
      daily_loss_limit: form.daily_loss_limit_enabled && form.daily_loss_limit ? parseFloat(form.daily_loss_limit) : null,
    };

    try {
      if (editing) {
        const { error } = await supabase.from('accounts').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Account updated');
      } else {
        const { error } = await supabase.from('accounts').insert({ ...payload, user_id: user.id, is_default: accounts.length === 0 });
        if (error) throw error;
        toast.success('Account created');
      }
      setDialogOpen(false);
      fetchAccounts();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Unset all defaults first
    await supabase.from('accounts').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('accounts').update({ is_default: true }).eq('id', id);
    toast.success('Default account updated');
    fetchAccounts();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('accounts').delete().eq('id', deleting.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Account deleted');
    setDeleteDialogOpen(false);
    setDeleting(null);
    fetchAccounts();
  };

  const isPropFirm = (type: string | null) => type === 'propfirm_eval' || type === 'propfirm_funded';

  if (loading) return <JournalLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></JournalLayout>;

  return (
    <JournalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage trading accounts and risk rules</p>
          </div>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />New Account</Button>
        </div>

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No Accounts Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first trading account to start tracking performance per account.</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Create Account</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {accounts.map(acc => {
              const stats = accountStats[acc.id] || { trades: 0, pnl: 0 };
              const currentBalance = (acc.starting_balance || 0) + stats.pnl;
              const propFirm = isPropFirm(acc.account_type);

              // Calculate rule breaches
              const maxLossBreached = acc.max_loss_limit && stats.pnl < 0 && Math.abs(stats.pnl) >= acc.max_loss_limit;
              const profitTargetReached = acc.profit_target && stats.pnl >= acc.profit_target;

              return (
                <Card key={acc.id} className={cn('transition-all hover:border-primary/30', acc.status === 'blown' && 'border-destructive/50 opacity-75')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{acc.name}</CardTitle>
                          {acc.is_default && <Badge className="bg-primary/20 text-primary text-xs"><Star className="h-3 w-3 mr-0.5" />Default</Badge>}
                          <Badge variant="outline" className="text-xs">
                            {ACCOUNT_TYPES.find(t => t.value === acc.account_type)?.label || 'Personal'}
                          </Badge>
                          {acc.status === 'blown' && <Badge variant="destructive" className="text-xs">Blown</Badge>}
                        </div>
                        {acc.broker && <p className="text-xs text-muted-foreground">{acc.broker} · {acc.currency}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {!acc.is_default && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(acc.id)} title="Set as default">
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleting(acc); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Balance & P&L */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Starting</p>
                        <p className="font-mono font-semibold text-sm">{formatCurrency(acc.starting_balance || 0)}</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-muted-foreground">Current</p>
                        <p className={cn('font-mono font-semibold text-sm', currentBalance >= (acc.starting_balance || 0) ? 'text-profit' : 'text-loss')}>
                          {formatCurrency(currentBalance)}
                        </p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-muted-foreground">P&L</p>
                        <p className={cn('font-mono font-semibold text-sm', stats.pnl >= 0 ? 'text-profit' : 'text-loss')}>
                          {stats.pnl >= 0 ? '+' : ''}{formatCurrency(stats.pnl)}
                        </p>
                      </div>
                    </div>

                    {/* Prop Firm Rules */}
                    {propFirm && (
                      <div className="space-y-1.5">
                        {acc.max_loss_limit != null && (
                          <RuleBar
                            label="Max Loss Limit"
                            icon={<Shield className="h-3.5 w-3.5" />}
                            current={Math.abs(Math.min(stats.pnl, 0))}
                            limit={acc.max_loss_limit}
                            breached={!!maxLossBreached}
                            type="loss"
                          />
                        )}
                        {acc.profit_target != null && (
                          <RuleBar
                            label="Profit Target"
                            icon={<Target className="h-3.5 w-3.5" />}
                            current={Math.max(stats.pnl, 0)}
                            limit={acc.profit_target}
                            breached={!!profitTargetReached}
                            type="profit"
                          />
                        )}
                        {acc.daily_loss_limit_enabled && acc.daily_loss_limit != null && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <TrendingDown className="h-3.5 w-3.5" />
                            <span>Daily Loss Limit: {formatCurrency(acc.daily_loss_limit)}</span>
                            <Badge variant="outline" className="text-[10px]">Active</Badge>
                          </div>
                        )}
                        {acc.consistency_enabled && acc.consistency_percent != null && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Consistency Rule: {acc.consistency_percent}%</span>
                            <Badge variant="outline" className="text-[10px]">Active</Badge>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">{stats.trades} trades · {acc.timezone}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Account' : 'New Account'}</DialogTitle>
            <DialogDescription>{editing ? 'Update account settings and risk rules.' : 'Create a new trading account with risk management rules.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Basic Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account Info</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Account Name *</Label>
                  <Input placeholder="e.g. FTMO 100K Challenge" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Broker</Label>
                  <Input placeholder="e.g. FTMO, Tradovate" value={form.broker} onChange={e => setForm({ ...form, broker: e.target.value })} maxLength={50} />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={form.timezone} onValueChange={v => setForm({ ...form, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Starting Balance</Label>
                  <Input type="number" placeholder="e.g. 100000" value={form.starting_balance} onChange={e => setForm({ ...form, starting_balance: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Risk Rules — show for all but highlight for prop firm */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Risk Rules</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Maximum Loss Limit</Label>
                    <Input type="number" placeholder="e.g. 10000" value={form.max_loss_limit} onChange={e => setForm({ ...form, max_loss_limit: e.target.value })} />
                    <p className="text-[11px] text-muted-foreground">Max drawdown before account is blown</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Profit Target</Label>
                    <Input type="number" placeholder="e.g. 10000" value={form.profit_target} onChange={e => setForm({ ...form, profit_target: e.target.value })} />
                    <p className="text-[11px] text-muted-foreground">Target profit to pass evaluation</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Daily Loss Limit</Label>
                      <p className="text-[11px] text-muted-foreground">Maximum loss allowed per day</p>
                    </div>
                    <Switch checked={form.daily_loss_limit_enabled} onCheckedChange={v => setForm({ ...form, daily_loss_limit_enabled: v })} />
                  </div>
                  {form.daily_loss_limit_enabled && (
                    <Input type="number" placeholder="e.g. 2000" value={form.daily_loss_limit} onChange={e => setForm({ ...form, daily_loss_limit: e.target.value })} />
                  )}
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Consistency Rule</Label>
                      <p className="text-[11px] text-muted-foreground">Max % of total profit from a single day</p>
                    </div>
                    <Switch checked={form.consistency_enabled} onCheckedChange={v => setForm({ ...form, consistency_enabled: v })} />
                  </div>
                  {form.consistency_enabled && (
                    <div className="flex items-center gap-2">
                      <Input type="number" placeholder="e.g. 30" value={form.consistency_percent} onChange={e => setForm({ ...form, consistency_percent: e.target.value })} className="w-24" />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
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
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleting?.name}"? Trades linked to this account will lose their account assignment.
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

// --- Progress bar component for rules ---
function RuleBar({ label, icon, current, limit, breached, type }: {
  label: string; icon: React.ReactNode; current: number; limit: number; breached: boolean; type: 'loss' | 'profit';
}) {
  const percent = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const barColor = type === 'loss'
    ? (percent >= 80 ? 'bg-loss' : percent >= 50 ? 'bg-yellow-500' : 'bg-profit')
    : (breached ? 'bg-profit' : 'bg-primary');

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={cn('font-mono', breached ? (type === 'loss' ? 'text-loss' : 'text-profit') : 'text-foreground')}>
          {formatCurrency(current)} / {formatCurrency(limit)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
