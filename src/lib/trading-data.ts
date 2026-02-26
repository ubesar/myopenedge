import { Trade, DashboardStats, EquityPoint, PnlByDay, BreakdownItem } from '@/types/trading';

export function calculateStats(trades: Trade[]): DashboardStats {
  if (trades.length === 0) {
    return { totalPnl: 0, winRate: 0, profitFactor: 0, expectancy: 0, maxDrawdown: 0, avgRMultiple: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0 };
  }
  const winningTrades = trades.filter(t => t.pnlNet > 0);
  const losingTrades = trades.filter(t => t.pnlNet < 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnlNet, 0);
  const winRate = (winningTrades.length / trades.length) * 100;
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnlNet, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlNet, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  const expectancy = totalPnl / trades.length;
  let peak = 0, maxDrawdown = 0, cumulative = 0;
  for (const trade of trades) {
    cumulative += trade.pnlNet;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  const avgRMultiple = trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / trades.length;
  return { totalPnl, winRate, profitFactor, expectancy, maxDrawdown, avgRMultiple, totalTrades: trades.length, winningTrades: winningTrades.length, losingTrades: losingTrades.length };
}

export function generateEquityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());
  let cumulative = 0;
  return sorted.map(t => { cumulative += t.pnlNet; return { date: t.closeTime.split('T')[0], equity: cumulative, pnl: t.pnlNet }; });
}

export function getPnlByDay(trades: Trade[]): PnlByDay[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDay: Record<string, { pnl: number; trades: number }> = {};
  days.forEach(d => byDay[d] = { pnl: 0, trades: 0 });
  trades.forEach(t => { const d = days[new Date(t.closeTime).getDay()]; byDay[d].pnl += t.pnlNet; byDay[d].trades += 1; });
  return days.map(d => ({ day: d, pnl: byDay[d].pnl, trades: byDay[d].trades }));
}

export function getBreakdownBySession(trades: Trade[]): BreakdownItem[] {
  const sessions = ['ASIA', 'LONDON', 'NY', 'OVERLAP'];
  return sessions.map(s => { const st = trades.filter(t => t.session === s); const w = st.filter(t => t.pnlNet > 0).length; return { name: s, pnl: st.reduce((sum, t) => sum + t.pnlNet, 0), trades: st.length, winRate: st.length > 0 ? (w / st.length) * 100 : 0 }; }).filter(s => s.trades > 0);
}

export function getBreakdownBySetup(trades: Trade[]): BreakdownItem[] {
  const map: Record<string, { pnl: number; trades: number; wins: number }> = {};
  trades.forEach(t => t.setupTags.forEach(tag => { if (!map[tag]) map[tag] = { pnl: 0, trades: 0, wins: 0 }; map[tag].pnl += t.pnlNet; map[tag].trades++; if (t.pnlNet > 0) map[tag].wins++; }));
  return Object.entries(map).map(([n, d]) => ({ name: n, pnl: d.pnl, trades: d.trades, winRate: (d.wins / d.trades) * 100 })).sort((a, b) => b.pnl - a.pnl);
}

export function getBreakdownBySymbol(trades: Trade[]): BreakdownItem[] {
  const map: Record<string, { pnl: number; trades: number; wins: number }> = {};
  trades.forEach(t => { if (!map[t.symbol]) map[t.symbol] = { pnl: 0, trades: 0, wins: 0 }; map[t.symbol].pnl += t.pnlNet; map[t.symbol].trades++; if (t.pnlNet > 0) map[t.symbol].wins++; });
  return Object.entries(map).map(([n, d]) => ({ name: n, pnl: d.pnl, trades: d.trades, winRate: (d.wins / d.trades) * 100 })).sort((a, b) => b.pnl - a.pnl);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
