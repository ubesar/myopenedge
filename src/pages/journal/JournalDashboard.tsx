import { useState, useEffect } from 'react';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { supabase } from '@/integrations/supabase/client';
import { Trade } from '@/types/trading';
import { calculateStats, generateEquityCurve, getPnlByDay, getBreakdownBySession, getBreakdownBySetup, getBreakdownBySymbol, formatCurrency, formatPercent } from '@/lib/trading-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Target, TrendingUp, TrendingDown, Activity, Percent, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

function mapDbToTrade(db: any): Trade {
  return { id: db.id, symbol: db.symbol, side: db.side, qty: db.qty, entryPrice: db.entry_price, exitPrice: db.exit_price, openTime: db.open_time, closeTime: db.close_time, pnlGross: db.pnl_gross, fees: db.fees || 0, pnlNet: db.pnl_net, rMultiple: db.r_multiple ?? undefined, session: db.session ?? undefined, setupTags: db.setup_tags || [], grade: db.grade ?? undefined, source: 'MANUAL', createdAt: db.close_time };
}

export default function JournalDashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('trades').select('*').order('close_time', { ascending: true });
      if (data) setTrades(data.map(mapDbToTrade));
      setLoading(false);
    };
    fetch();
  }, []);

  const stats = calculateStats(trades);
  const equityCurve = generateEquityCurve(trades);
  const pnlByDay = getPnlByDay(trades);
  const sessionBreakdown = getBreakdownBySession(trades);
  const symbolBreakdown = getBreakdownBySymbol(trades);

  if (loading) return <JournalLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></JournalLayout>;

  return (
    <JournalLayout>
      <div className="space-y-4 sm:space-y-6">
        <div><h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1><p className="text-sm text-muted-foreground">Your trading performance at a glance</p></div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
          {[
            { title: 'Net P&L', value: formatCurrency(stats.totalPnl), color: stats.totalPnl >= 0 ? 'text-profit' : 'text-loss' },
            { title: 'Win Rate', value: formatPercent(stats.winRate), color: stats.winRate >= 50 ? 'text-profit' : 'text-loss' },
            { title: 'Profit Factor', value: stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? 'text-profit' : 'text-loss' },
            { title: 'Expectancy', value: formatCurrency(stats.expectancy), color: stats.expectancy >= 0 ? 'text-profit' : 'text-loss' },
            { title: 'Max Drawdown', value: formatCurrency(stats.maxDrawdown), color: 'text-loss' },
            { title: 'Avg R', value: stats.avgRMultiple.toFixed(2) + 'R', color: stats.avgRMultiple >= 0 ? 'text-profit' : 'text-loss' },
          ].map(s => (
            <Card key={s.title}><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">{s.title}</p><p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p></CardContent></Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Trades</p><p className="text-lg font-bold">{stats.totalTrades}</p></CardContent></Card>
          <Card className="gradient-profit"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Winners</p><p className="text-lg font-bold text-profit">{stats.winningTrades}</p></CardContent></Card>
          <Card className="gradient-loss"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Losers</p><p className="text-lg font-bold text-loss">{stats.losingTrades}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><CardHeader><CardTitle>Equity Curve</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={equityCurve}><defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--profit))" stopOpacity={0.3}/><stop offset="100%" stopColor="hsl(var(--profit))" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="date" tick={{fontSize:10, fill:'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize:10, fill:'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/><Tooltip contentStyle={{backgroundColor:'hsl(var(--card))',border:'1px solid hsl(var(--border))',borderRadius:'8px',fontSize:'12px'}} formatter={(v:number)=>[formatCurrency(v),'Equity']}/><Area type="monotone" dataKey="equity" stroke="hsl(var(--profit))" strokeWidth={2} fill="url(#eqGrad)"/></AreaChart></ResponsiveContainer></div></CardContent></Card>
          <Card><CardHeader><CardTitle>P&L by Day</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={pnlByDay}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="day" tick={{fontSize:12,fill:'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize:12,fill:'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false} tickFormatter={v=>`$${v}`}/><Tooltip contentStyle={{backgroundColor:'hsl(var(--card))',border:'1px solid hsl(var(--border))',borderRadius:'8px'}} formatter={(v:number)=>[formatCurrency(v),'P&L']}/><Bar dataKey="pnl" radius={[4,4,0,0]}>{pnlByDay.map((e,i)=><Cell key={i} fill={e.pnl>=0?'hsl(var(--profit))':'hsl(var(--loss))'} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{title:'By Session',data:sessionBreakdown},{title:'By Symbol',data:symbolBreakdown}].map(({title,data})=>(
            <Card key={title}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><div className="space-y-3">{data.length===0?<p className="text-sm text-muted-foreground text-center py-4">No data</p>:data.map(item=>(<div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"><div className="flex items-center gap-3"><div className={cn('w-2 h-2 rounded-full',item.pnl>=0?'bg-profit':'bg-loss')}/><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.trades} trades · {formatPercent(item.winRate)} WR</p></div></div><p className={cn('font-mono font-semibold',item.pnl>=0?'text-profit':'text-loss')}>{item.pnl>=0?'+':''}{formatCurrency(item.pnl)}</p></div>))}</div></CardContent></Card>
          ))}
        </div>
      </div>
    </JournalLayout>
  );
}
