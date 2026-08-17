import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

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

interface JournalChartsProps {
  trades: Trade[];
}

const netPnl = (t: Trade) => t.pnl_gross - (t.fees || 0);

const JournalCharts = ({ trades }: JournalChartsProps) => {
  const { cumulativeData, drawdownData, pnlBarData, radarData, score } = useMemo(() => {
    if (!trades.length) return { cumulativeData: [], drawdownData: [], pnlBarData: [], radarData: [] };

    // Sort by close_time
    const sorted = [...trades].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime());

    // Daily cumulative PNL (after fees)
    const dayPnl = new Map<string, number>();
    sorted.forEach((t) => {
      const day = t.close_time.slice(0, 10);
      dayPnl.set(day, (dayPnl.get(day) || 0) + netPnl(t));
    });

    let cumSum = 0;
    const cumulativeData = Array.from(dayPnl.entries()).map(([date, pnl]) => {
      cumSum += pnl;
      return { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), pnl: cumSum };
    });

    // Drawdown
    let peak = 0;
    const drawdownData = cumulativeData.map((d) => {
      if (d.pnl > peak) peak = d.pnl;
      const dd = peak > 0 ? d.pnl - peak : 0;
      return { date: d.date, drawdown: dd };
    });

    // PNL bar per day
    const pnlBarData = Array.from(dayPnl.entries()).map(([date, pnl]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pnl,
    }));

    // Radar: Win%, Profit Factor, Win/Loss ratio
    const wins = sorted.filter((t) => netPnl(t) > 0);
    const losses = sorted.filter((t) => netPnl(t) < 0);
    const winRate = (wins.length / sorted.length) * 100;
    const grossProfit = wins.reduce((s, t) => s + netPnl(t), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + netPnl(t), 0));
    const profitFactor = grossLoss > 0 ? Math.min((grossProfit / grossLoss) * 20, 100) : grossProfit > 0 ? 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length) : 0;
    const winLossRatio = avgLoss > 0 ? Math.min((avgWin / avgLoss) * 25, 100) : avgWin > 0 ? 100 : 0;

    const radarData = [
      { metric: "Win %", value: winRate },
      { metric: "Profit Factor", value: profitFactor },
      { metric: "Win/Loss", value: winLossRatio },
    ];

    // Overall score 0-100
    const score = Math.round(winRate * 0.4 + profitFactor * 0.35 + winLossRatio * 0.25);

    return { cumulativeData, drawdownData, pnlBarData, radarData, score };
  }, [trades]);

  const chartCard = (title: string, children: React.ReactNode) => (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-[12px] font-semibold text-foreground">{title}</p>
      <div className="h-[180px]">{children}</div>
    </div>
  );

  const scoreColor = score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444";

  if (!trades.length) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse h-[230px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {/* Score Radar + Score Bar */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[12px] font-semibold text-foreground">Score</p>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Score gauge */}
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold" style={{ color: scoreColor }}>{score}</span>
            <span className="text-[11px] text-muted-foreground">/ 100</span>
          </div>
          <div className="relative h-2 w-full rounded-full overflow-hidden bg-secondary">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, #ef4444 0%, #eab308 40%, #22c55e 100%)",
              }}
            />
            <div
              className="absolute top-0 right-0 h-full bg-secondary/80 rounded-r-full transition-all duration-500"
              style={{ width: `${100 - Math.min(score, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cumulative PNL */}
      {chartCard(
        "Daily Cumulative PNL",
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cumulativeData}>
            <defs>
              <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="pnl" stroke="#22c55e" fill="url(#cumGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Drawdown */}
      {chartCard(
        "Drawdown",
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={drawdownData}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="drawdown" stroke="#ef4444" dot={{ r: 3, fill: "#ef4444" }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* PNL Bar */}
      {chartCard(
        "PNL",
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pnlBarData}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="pnl" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default JournalCharts;
