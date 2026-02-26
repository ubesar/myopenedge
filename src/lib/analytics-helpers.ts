// Analytics calculation helpers for trading dashboard
import { format, parseISO, subDays, isAfter, isBefore } from 'date-fns';

export interface AnalyticsTrade {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  pnl_net: number;
  pnl_gross: number;
  fees: number | null;
  close_time: string;
  open_time: string;
  playbook: string | null;
  playbook_id: string | null;
  r_multiple: number | null;
  sl_ticks: number | null;
  tp_ticks: number | null;
  account_id: string | null;
}

export interface FilterState {
  dateRange: { from: Date; to: Date };
  instrument: string;
  account: string;
  direction: string;
  playbook: string;
}

export interface KPIStats {
  netPnl: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  currentStreak: { type: 'W' | 'L' | 'none'; count: number };
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
}

export interface EquityCurvePoint {
  date: string;
  dailyNet: number;
  cumulative: number;
}

export interface DirectionStats {
  direction: string;
  trades: number;
  winRate: number;
  netPnl: number;
}

export interface MonthlyPerformance {
  month: string;
  netPnl: number;
}

export interface DetailedStats {
  totalTrades: number;
  profitFactor: number;
  winRate: number;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  largestWin: number;
  largestLoss: number;
  avgSlTicks: number | null;
  avgTpTicks: number | null;
  avgRR: number | null;
  avgTrade: number;
  greenDays: number;
  totalDays: number;
  consistencyScore: number;
}

export interface PlaybookRow {
  playbook: string;
  playbook_id: string | null;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
  profitFactor: number;
  avgR: number | null;
}

export interface CalendarDay {
  date: string;
  netPnl: number;
  trades: number;
}

export interface ScoreComponents {
  winRate: number;
  profitFactor: number;
  consistency: number;
  drawdown: number;
  expectancy: number;
  overall: number;
}

export function filterTrades(trades: AnalyticsTrade[], filters: FilterState): AnalyticsTrade[] {
  return trades.filter(trade => {
    const closeDate = parseISO(trade.close_time);
    if (isBefore(closeDate, filters.dateRange.from) || isAfter(closeDate, filters.dateRange.to)) return false;
    if (filters.instrument !== 'all' && trade.symbol !== filters.instrument) return false;
    if (filters.account !== 'all' && trade.account_id !== filters.account) return false;
    if (filters.direction !== 'all' && trade.side !== filters.direction) return false;
    if (filters.playbook !== 'all' && trade.playbook_id !== filters.playbook) return false;
    return true;
  });
}

export function calculateKPIs(trades: AnalyticsTrade[]): KPIStats {
  const totalTrades = trades.length;
  if (totalTrades === 0) return { netPnl: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, winLossRatio: 0, currentStreak: { type: 'none', count: 0 }, totalTrades: 0, wins: 0, losses: 0, breakeven: 0 };
  const wins = trades.filter(t => t.pnl_net > 0);
  const losses = trades.filter(t => t.pnl_net < 0);
  const breakeven = trades.filter(t => t.pnl_net === 0);
  const netPnl = trades.reduce((sum, t) => sum + t.pnl_net, 0);
  const winRate = (wins.length / totalTrades) * 100;
  const grossProfit = trades.filter(t => t.pnl_gross > 0).reduce((sum, t) => sum + t.pnl_gross, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnl_gross < 0).reduce((sum, t) => sum + t.pnl_gross, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl_net, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl_net, 0) / losses.length) : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const sortedTrades = [...trades].sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime());
  let streakType: 'W' | 'L' | 'none' = 'none';
  let streakCount = 0;
  for (const trade of sortedTrades) {
    const result = trade.pnl_net > 0 ? 'W' : trade.pnl_net < 0 ? 'L' : null;
    if (result === null) continue;
    if (streakType === 'none') { streakType = result; streakCount = 1; } else if (streakType === result) { streakCount++; } else { break; }
  }
  return { netPnl, winRate, profitFactor, avgWin, avgLoss, winLossRatio, currentStreak: { type: streakType, count: streakCount }, totalTrades, wins: wins.length, losses: losses.length, breakeven: breakeven.length };
}

export function generateEquityCurve(trades: AnalyticsTrade[]): EquityCurvePoint[] {
  if (trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime());
  const dailyPnL: Record<string, number> = {};
  sorted.forEach(trade => { const day = format(parseISO(trade.close_time), 'yyyy-MM-dd'); dailyPnL[day] = (dailyPnL[day] || 0) + trade.pnl_net; });
  let cumulative = 0;
  return Object.entries(dailyPnL).sort(([a], [b]) => a.localeCompare(b)).map(([date, dailyNet]) => { cumulative += dailyNet; return { date, dailyNet, cumulative }; });
}

export function calculateMaxDrawdown(equityCurve: EquityCurvePoint[]): { amount: number; percent: number } {
  if (equityCurve.length === 0) return { amount: 0, percent: 0 };
  let peak = equityCurve[0].cumulative;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  for (const point of equityCurve) {
    if (point.cumulative > peak) peak = point.cumulative;
    const drawdown = peak - point.cumulative;
    if (drawdown > maxDrawdown) { maxDrawdown = drawdown; maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0; }
  }
  return { amount: maxDrawdown, percent: maxDrawdownPercent };
}

export function calculateDirectionStats(trades: AnalyticsTrade[]): DirectionStats[] {
  const calc = (dirTrades: AnalyticsTrade[], direction: string): DirectionStats => {
    const total = dirTrades.length;
    const wins = dirTrades.filter(t => t.pnl_net > 0).length;
    return { direction, trades: total, winRate: total > 0 ? (wins / total) * 100 : 0, netPnl: dirTrades.reduce((sum, t) => sum + t.pnl_net, 0) };
  };
  return [calc(trades.filter(t => t.side === 'LONG'), 'LONG'), calc(trades.filter(t => t.side === 'SHORT'), 'SHORT')];
}

export function calculateMonthlyPerformance(trades: AnalyticsTrade[]): MonthlyPerformance[] {
  const monthlyPnL: Record<string, number> = {};
  trades.forEach(trade => { const month = format(parseISO(trade.close_time), 'yyyy-MM'); monthlyPnL[month] = (monthlyPnL[month] || 0) + trade.pnl_net; });
  return Object.entries(monthlyPnL).sort(([a], [b]) => a.localeCompare(b)).map(([month, netPnl]) => ({ month, netPnl }));
}

export function calculateDetailedStats(trades: AnalyticsTrade[], equityCurve: EquityCurvePoint[]): DetailedStats {
  const kpis = calculateKPIs(trades);
  const drawdown = calculateMaxDrawdown(equityCurve);
  const allPnl = trades.map(t => t.pnl_net);
  const largestWin = allPnl.length > 0 ? Math.max(...allPnl, 0) : 0;
  const largestLoss = allPnl.length > 0 ? Math.min(...allPnl, 0) : 0;
  const avgTrade = kpis.totalTrades > 0 ? kpis.netPnl / kpis.totalTrades : 0;
  const winRateDecimal = kpis.winRate / 100;
  const expectancy = (winRateDecimal * kpis.avgWin) - ((1 - winRateDecimal) * kpis.avgLoss);
  const slTicks = trades.filter(t => t.sl_ticks !== null).map(t => t.sl_ticks!);
  const tpTicks = trades.filter(t => t.tp_ticks !== null).map(t => t.tp_ticks!);
  const rrValues = trades.filter(t => t.r_multiple !== null).map(t => t.r_multiple!);
  const avgSlTicks = slTicks.length > 0 ? slTicks.reduce((a, b) => a + b, 0) / slTicks.length : null;
  const avgTpTicks = tpTicks.length > 0 ? tpTicks.reduce((a, b) => a + b, 0) / tpTicks.length : null;
  const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : null;
  const greenDays = equityCurve.filter(d => d.dailyNet > 0).length;
  const totalDays = equityCurve.length;
  const consistencyScore = totalDays > 0 ? (greenDays / totalDays) * 100 : 0;
  return { totalTrades: kpis.totalTrades, profitFactor: kpis.profitFactor, winRate: kpis.winRate, expectancy, maxDrawdown: drawdown.amount, maxDrawdownPercent: drawdown.percent, largestWin, largestLoss, avgSlTicks, avgTpTicks, avgRR, avgTrade, greenDays, totalDays, consistencyScore };
}

export function calculatePlaybookPerformance(trades: AnalyticsTrade[], playbooksMap?: Record<string, { name: string; tag: string | null }>): PlaybookRow[] {
  const playbookMap: Record<string, AnalyticsTrade[]> = {};
  trades.forEach(trade => { const pbId = trade.playbook_id || 'no-playbook'; if (!playbookMap[pbId]) playbookMap[pbId] = []; playbookMap[pbId].push(trade); });
  return Object.entries(playbookMap).map(([playbookId, pbTrades]) => {
    const wins = pbTrades.filter(t => t.pnl_net > 0);
    const netPnl = pbTrades.reduce((sum, t) => sum + t.pnl_net, 0);
    const grossProfit = pbTrades.filter(t => t.pnl_gross > 0).reduce((sum, t) => sum + t.pnl_gross, 0);
    const grossLoss = Math.abs(pbTrades.filter(t => t.pnl_gross < 0).reduce((sum, t) => sum + t.pnl_gross, 0));
    const rrValues = pbTrades.filter(t => t.r_multiple !== null).map(t => t.r_multiple!);
    const avgR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : null;
    const pbName = playbookId === 'no-playbook' ? 'No Playbook' : (playbooksMap?.[playbookId]?.name || 'Unknown');
    return { playbook: pbName, playbook_id: playbookId === 'no-playbook' ? null : playbookId, trades: pbTrades.length, wins: wins.length, winRate: (wins.length / pbTrades.length) * 100, netPnl, avgPnl: netPnl / pbTrades.length, profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0, avgR };
  }).sort((a, b) => b.netPnl - a.netPnl);
}

export function generateCalendarData(trades: AnalyticsTrade[]): CalendarDay[] {
  const dailyMap: Record<string, { pnl: number; count: number }> = {};
  trades.forEach(trade => { const day = format(parseISO(trade.close_time), 'yyyy-MM-dd'); if (!dailyMap[day]) dailyMap[day] = { pnl: 0, count: 0 }; dailyMap[day].pnl += trade.pnl_net; dailyMap[day].count += 1; });
  return Object.entries(dailyMap).map(([date, data]) => ({ date, netPnl: data.pnl, trades: data.count }));
}

export function calculateScoreComponents(stats: DetailedStats): ScoreComponents {
  const winRate = Math.min(stats.winRate, 100);
  const profitFactor = Math.min((stats.profitFactor / 3) * 100, 100);
  const consistency = stats.consistencyScore;
  const drawdown = Math.max(0, 100 - (stats.maxDrawdownPercent / 30) * 100);
  const expectancy = Math.min(Math.max((stats.expectancy / 100) * 100, 0), 100);
  const overall = (winRate + profitFactor + consistency + drawdown + expectancy) / 5;
  return { winRate, profitFactor, consistency, drawdown, expectancy, overall };
}

export function generateDemoTrades(userId: string): Omit<AnalyticsTrade, 'id'>[] {
  const instruments = ['MNQ', 'MES', 'ES', 'NQ'];
  const playbooks = ['A+ Breakout', 'ORB Pullback', 'VWAP Bounce', 'Gap Fill', 'Trend Continuation'];
  const directions = ['LONG', 'SHORT'];
  const trades: Omit<AnalyticsTrade, 'id'>[] = [];
  const now = new Date();
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 60);
    const exitDate = subDays(now, daysAgo);
    const entryDate = new Date(exitDate.getTime() - Math.random() * 4 * 60 * 60 * 1000);
    const isWin = Math.random() > 0.45;
    const pnlGross = isWin ? Math.random() * 400 + 50 : -(Math.random() * 300 + 50);
    const fees = Math.random() * 10 + 5;
    const pnlNet = pnlGross - fees;
    const qty = Math.floor(Math.random() * 3) + 1;
    const rMultiple = isWin ? (Math.random() * 2 + 0.5) : -(Math.random() * 1 + 0.2);
    trades.push({
      symbol: instruments[Math.floor(Math.random() * instruments.length)],
      side: directions[Math.floor(Math.random() * directions.length)],
      qty, pnl_net: parseFloat(pnlNet.toFixed(2)), pnl_gross: parseFloat(pnlGross.toFixed(2)),
      fees: parseFloat(fees.toFixed(2)), close_time: exitDate.toISOString(), open_time: entryDate.toISOString(),
      playbook: playbooks[Math.floor(Math.random() * playbooks.length)], playbook_id: null,
      r_multiple: parseFloat(rMultiple.toFixed(2)), sl_ticks: Math.floor(Math.random() * 20) + 5,
      tp_ticks: Math.floor(Math.random() * 40) + 10, account_id: null,
    });
  }
  return trades;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
