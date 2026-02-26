import { useState, useEffect } from 'react';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { Button } from '@/components/ui/button';
import { Loader2, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { subDays } from 'date-fns';

import { AnalyticsFilters } from '@/components/analytics/AnalyticsFilters';
import { KPICards } from '@/components/analytics/KPICards';
import { ScoreRadar } from '@/components/analytics/ScoreRadar';
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart';
import { DailyPnLChart } from '@/components/analytics/DailyPnLChart';
import { DirectionStats } from '@/components/analytics/DirectionStats';
import { MonthlyPerformance } from '@/components/analytics/MonthlyPerformance';
import { DetailedStatsPanel } from '@/components/analytics/DetailedStatsPanel';
import { PlaybookTable } from '@/components/analytics/PlaybookTable';
import { TradingCalendar } from '@/components/analytics/TradingCalendar';
import { TradesTable } from '@/components/analytics/TradesTable';
import { DaySummaryDialog } from '@/components/analytics/DaySummaryDialog';

import {
  AnalyticsTrade,
  FilterState,
  filterTrades,
  calculateKPIs,
  generateEquityCurve,
  calculateDirectionStats,
  calculateMonthlyPerformance,
  calculateDetailedStats,
  calculatePlaybookPerformance,
  generateCalendarData,
  calculateScoreComponents,
  generateDemoTrades,
} from '@/lib/analytics-helpers';

import { useAccounts } from '@/hooks/useAccounts';

export default function JournalAnalytics() {
  const { toast } = useToast();
  const { selectedAccountId } = useAccounts();
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [trades, setTrades] = useState<AnalyticsTrade[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [playbooksList, setPlaybooksList] = useState<{ id: string; name: string; tag: string | null }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySummaryOpen, setDaySummaryOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    dateRange: { from: subDays(new Date(), 30), to: new Date() },
    instrument: 'all',
    account: 'all',
    direction: 'all',
    playbook: 'all',
  });

  useEffect(() => { fetchData(); }, [selectedAccountId]);

  const fetchData = async () => {
    setLoading(true);
    let tradesQuery = supabase.from('trades').select('id, symbol, side, qty, pnl_net, pnl_gross, fees, close_time, open_time, playbook, playbook_id, r_multiple, sl_ticks, tp_ticks, account_id').order('close_time', { ascending: false });
    if (selectedAccountId !== 'all') tradesQuery = tradesQuery.eq('account_id', selectedAccountId);
    const [tradesRes, accountsRes, playbooksRes] = await Promise.all([
      tradesQuery,
      supabase.from('accounts').select('id, name'),
      supabase.from('playbooks').select('id, name, tag'),
    ]);
    if (tradesRes.data) setTrades(tradesRes.data as AnalyticsTrade[]);
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (playbooksRes.data) setPlaybooksList(playbooksRes.data);
    setLoading(false);
  };

  const loadDemoData = async () => {
    setLoadingDemo(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingDemo(false); return; }
    const demoTrades = generateDemoTrades(user.id);
    const toInsert = demoTrades.map(t => ({ ...t, user_id: user.id, entry_price: 100, exit_price: 100 + (t.pnl_gross / t.qty), source: 'MANUAL' }));
    const { error } = await supabase.from('trades').insert(toInsert);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Demo data loaded', description: '50 trades added' }); fetchData(); }
    setLoadingDemo(false);
  };

  const filteredTrades = filterTrades(trades, filters);
  const playbooksMap: Record<string, { name: string; tag: string | null }> = {};
  playbooksList.forEach(pb => { playbooksMap[pb.id] = { name: pb.name, tag: pb.tag }; });

  const kpis = calculateKPIs(filteredTrades);
  const equityCurve = generateEquityCurve(filteredTrades);
  const directionStats = calculateDirectionStats(filteredTrades);
  const monthlyPerformance = calculateMonthlyPerformance(filteredTrades);
  const detailedStats = calculateDetailedStats(filteredTrades, equityCurve);
  const playbookData = calculatePlaybookPerformance(filteredTrades, playbooksMap);
  const calendarData = generateCalendarData(filteredTrades);
  const scoreComponents = calculateScoreComponents(detailedStats);
  const instruments = [...new Set(trades.map(t => t.symbol))];

  if (loading) {
    return <JournalLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></JournalLayout>;
  }

  if (trades.length === 0) {
    return (
      <JournalLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <Database className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No trades yet</h2>
          <p className="text-muted-foreground text-center max-w-md">Import your trades or load demo data to see your analytics dashboard.</p>
          <Button onClick={loadDemoData} disabled={loadingDemo}>
            {loadingDemo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load Demo Data
          </Button>
        </div>
      </JournalLayout>
    );
  }

  return (
    <JournalLayout>
      <div className="space-y-3 sm:space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">Analytics</h1>

        <AnalyticsFilters filters={filters} onFiltersChange={setFilters} instruments={instruments} accounts={accounts} playbooks={playbooksList} />

        <KPICards stats={kpis} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <ScoreRadar scores={scoreComponents} />
          <EquityCurveChart data={equityCurve} />
          <DailyPnLChart data={equityCurve} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <DirectionStats data={directionStats} />
          <MonthlyPerformance data={monthlyPerformance} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <DetailedStatsPanel stats={detailedStats} />
          <PlaybookTable data={playbookData} />
        </div>

        <TradingCalendar data={calendarData} onDayClick={(date) => { setSelectedDate(date); setDaySummaryOpen(true); }} selectedDate={selectedDate} />

        <TradesTable trades={filteredTrades} selectedDate={selectedDate} playbooks={playbooksList} />

        <DaySummaryDialog open={daySummaryOpen} onOpenChange={setDaySummaryOpen} date={selectedDate} trades={filteredTrades} playbooks={playbooksList} />
      </div>
    </JournalLayout>
  );
}
