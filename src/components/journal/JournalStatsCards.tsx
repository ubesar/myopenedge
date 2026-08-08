import { useMemo } from "react";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface Trade {
  id: string;
  pnl_gross: number;
  pnl_net: number;
  fees: number | null;
  side: string;
  close_time: string;
  open_time: string;
  symbol: string;
}

interface JournalStatsCardsProps {
  trades: Trade[];
}

const netPnl = (t: Trade) => t.pnl_gross - (t.fees || 0);

const JournalStatsCards = ({ trades }: JournalStatsCardsProps) => {
  const stats = useMemo(() => {
    if (!trades.length) return null;

    const wins = trades.filter((t) => netPnl(t) > 0);
    const losses = trades.filter((t) => netPnl(t) < 0);
    const winRate = (wins.length / trades.length) * 100;

    // Day win % (after fees)
    const dayMap = new Map<string, number>();
    trades.forEach((t) => {
      const day = t.close_time.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + netPnl(t));
    });
    const dayWins = Array.from(dayMap.values()).filter((v) => v > 0).length;
    const dayWinPct = dayMap.size > 0 ? (dayWins / dayMap.size) * 100 : 0;

    // Avg win / loss
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length) : 0;

    // Long vs short (after fees)
    const longPnl = trades
      .filter((t) => t.side?.toLowerCase() === "long" || t.side?.toLowerCase() === "buy")
      .reduce((s, t) => s + netPnl(t), 0);
    const shortPnl = trades
      .filter((t) => t.side?.toLowerCase() === "short" || t.side?.toLowerCase() === "sell")
      .reduce((s, t) => s + netPnl(t), 0);

    // Totals
    const grossPnl = trades.reduce((s, t) => s + t.pnl_gross, 0);
    const totalFees = trades.reduce((s, t) => s + (t.fees || 0), 0);
    const totalPnl = grossPnl - totalFees;

    // Profit factor
    const grossProfit = wins.reduce((s, t) => s + netPnl(t), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + netPnl(t), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      winRate,
      wins: wins.length,
      losses: losses.length,
      dayWinPct,
      dayWins,
      dayLosses: dayMap.size - dayWins,
      avgWin,
      avgLoss,
      longPnl,
      shortPnl,
      grossPnl,
      totalFees,
      totalPnl,
      totalTrades: trades.length,
      profitFactor,
    };
  }, [trades]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`;

  const cards = [
    {
      label: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      sub: `${stats.wins}W - ${stats.losses}L`,
      color: stats.winRate >= 50 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Day Win %",
      value: `${stats.dayWinPct.toFixed(1)}%`,
      sub: `${stats.dayWins}W - ${stats.dayLosses}L`,
      color: stats.dayWinPct >= 50 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Avg Win / Loss",
      value: fmt(stats.avgWin),
      sub: `${fmt(stats.avgWin)} / ${fmt(stats.avgLoss)}`,
      color: "text-green-400",
    },
    {
      label: "Long vs Short",
      value: `${stats.totalPnl >= 0 ? "+" : ""}${fmt(stats.totalPnl)}`,
      sub: `L: ${stats.longPnl >= 0 ? "+" : ""}${fmt(stats.longPnl)}  S: ${stats.shortPnl >= 0 ? "+" : ""}${fmt(stats.shortPnl)}`,
      color: stats.totalPnl >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Total PnL",
      value: `${stats.totalPnl >= 0 ? "+" : ""}${fmt(stats.totalPnl)}`,
      sub: `gross ${fmt(stats.grossPnl)} · fees ${fmt(stats.totalFees)}`,
      color: stats.totalPnl >= 0 ? "text-green-400" : "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-4 space-y-1"
        >
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {card.label}
          </p>
          <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
          <p className="text-[11px] text-muted-foreground">{card.sub}</p>
        </div>
      ))}
    </div>
  );
};

export default JournalStatsCards;
