import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar, Cell, ReferenceLine } from "recharts";

/** equity curve */
export const EquityCurveChart = ({ data }: { data: { trade: number; pnl: number }[] }) => {
  if (data.length === 0) return null;
  const min = Math.min(...data.map(d => d.pnl));
  const max = Math.max(...data.map(d => d.pnl));
  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg">
      <h3 className="text-xs font-semibold text-card-foreground mb-2">cumulative p&l (equity curve)</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="trade" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(data.length / 10))} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(1)} domain={[min - 1, max + 1]} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const v = payload[0].value as number;
                return (
                  <div className="rounded-md border border-border bg-card px-3 py-1.5 text-xs shadow-lg">
                    <span className="text-muted-foreground">trade #{payload[0].payload.trade}: </span>
                    <span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>{v >= 0 ? "+" : ""}{v.toFixed(2)} pts</span>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="pnl" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** daily pnl bar chart */
export const DailyPnlChart = ({ data }: { data: { date: string; pnl: number }[] }) => {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg">
      <h3 className="text-xs font-semibold text-card-foreground mb-2">daily p&l</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(data.length / 8))} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(1)} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-md border border-border bg-card px-3 py-1.5 text-xs shadow-lg">
                    <span className="text-muted-foreground">{d.date}: </span>
                    <span className={d.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>{d.pnl >= 0 ? "+" : ""}{d.pnl.toFixed(2)} pts</span>
                  </div>
                );
              }}
            />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={12}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? "hsl(142,71%,45%)" : "hsl(0,84%,60%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EquityCurveChart;
