import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/backtest-engine";

interface Props {
  equity: EquityPoint[];
  benchmark: { date: string; pct: number; equity: number }[];
  accountSize: number;
  symbol: string;
}

const EquityChart = ({ equity, benchmark, accountSize, symbol }: Props) => {
  const [pctMode, setPctMode] = useState(false);

  const bmByDate = new Map(benchmark.map((b) => [b.date, b]));
  const data = equity.map((e) => {
    const b = bmByDate.get(e.date);
    return {
      i: e.i,
      date: e.date,
      strategy: pctMode ? e.pctReturn : e.equity,
      gross: pctMode ? ((e.gross - accountSize) / accountSize) * 100 : e.gross,
      hold: b ? (pctMode ? b.pct : b.equity) : undefined,
    };
  });

  const f = (v: number) =>
    pctMode ? `${v.toFixed(1)}%` : `$${Math.round(v).toLocaleString()}`;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-medium text-foreground lowercase">equity curve (net) vs buy &amp; hold {symbol.toLowerCase()}</p>
        <button
          onClick={() => setPctMode(!pctMode)}
          className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground lowercase"
        >
          {pctMode ? "show $" : "show %"}
        </button>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} minTickGap={30} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={f} width={64} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
              formatter={(v: number, k: string) => [f(v), k]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="strategy" name="net strategy" stroke="hsl(var(--primary))" fill="url(#eqfill)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="gross" name="gross (pre-cost)" stroke="hsl(0 0% 55%)" strokeDasharray="4 3" strokeWidth={1} dot={false} />
            <Line type="monotone" dataKey="hold" name={`buy & hold ${symbol.toLowerCase()}`} stroke="hsl(38 92% 55%)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EquityChart;
