import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import type { MomentumResult } from "@/lib/momentum-analysis";

interface MomentumChartProps {
  result: MomentumResult;
}

const MomentumChart = ({ result }: MomentumChartProps) => {
  const {
    totalTrades, wins, losses, winRate, profitFactor,
    expectancy, netPnl, maxDrawdown, equityCurve,
    highFirst, lowFirst,
  } = result;

  const metrics = [
    { label: "total trades", value: totalTrades.toString() },
    { label: "win rate", value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? "text-emerald-400" : "text-red-400" },
    { label: "profit factor", value: profitFactor === Infinity ? "∞" : profitFactor.toFixed(2), color: profitFactor >= 1 ? "text-emerald-400" : "text-red-400" },
    { label: "expectancy", value: `$${expectancy.toFixed(2)}`, color: expectancy >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "net p&l", value: `$${netPnl.toFixed(2)}`, color: netPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "max drawdown", value: `$${maxDrawdown.toFixed(2)}`, color: "text-amber-400" },
  ];

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg h-full flex flex-col">
      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded border border-border/20 bg-muted/30 px-2 py-1.5 text-center">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{m.label}</div>
            <div className={`text-sm font-bold ${m.color || "text-card-foreground"}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Win/Loss bar */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden flex">
          {totalTrades > 0 && (
            <>
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(wins / totalTrades) * 100}%` }} />
              <div className="h-full bg-red-500 transition-all" style={{ width: `${(losses / totalTrades) * 100}%` }} />
            </>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{wins}W / {losses}L</span>
      </div>

      {/* IB High/Low First Stats */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <div className="rounded border border-border/20 bg-muted/20 px-2 py-1">
          <div className="text-[9px] text-muted-foreground">ib high first ({highFirst.total}d)</div>
          <div className="text-xs font-semibold text-card-foreground">
            {highFirst.trades} trades · <span className={highFirst.winRate >= 50 ? "text-emerald-400" : "text-red-400"}>{highFirst.winRate.toFixed(0)}% wr</span>
          </div>
        </div>
        <div className="rounded border border-border/20 bg-muted/20 px-2 py-1">
          <div className="text-[9px] text-muted-foreground">ib low first ({lowFirst.total}d)</div>
          <div className="text-xs font-semibold text-card-foreground">
            {lowFirst.trades} trades · <span className={lowFirst.winRate >= 50 ? "text-emerald-400" : "text-red-400"}>{lowFirst.winRate.toFixed(0)}% wr</span>
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-muted-foreground mb-1">equity curve (cumulative p&l)</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={equityCurve} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,15%)" vertical={false} />
            <XAxis dataKey="trade" tick={{ fill: "hsl(220,10%,45%)", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(220,10%,45%)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={45} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow-lg">
                    <div className="text-muted-foreground">trade #{d.trade}</div>
                    <div className={d.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                      p&l: ${d.pnl.toFixed(2)}
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MomentumChart;
