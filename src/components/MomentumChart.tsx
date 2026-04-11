import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList, LineChart, Line, Tooltip } from "recharts";

interface MomentumChartProps {
  title: string;
  total: number;
  bullish: number;
  bearish: number;
  choppy: number;
}

const MomentumChart = ({ title, total, bullish, bearish, choppy }: MomentumChartProps) => {
  const bullPct = total > 0 ? bullish / total * 100 : 0;
  const bearPct = total > 0 ? bearish / total * 100 : 0;
  const choppyPct = total > 0 ? choppy / total * 100 : 0;

  const data = [
    { name: "bullish", value: parseFloat(bullPct.toFixed(2)), type: "bullish" },
    { name: "bearish", value: parseFloat(bearPct.toFixed(2)), type: "bearish" },
    { name: "choppy", value: parseFloat(choppyPct.toFixed(2)), type: "choppy" },
  ];

  const colorMap: Record<string, string> = {
    bullish: "hsl(142,71%,45%)",
    bearish: "hsl(0,84%,60%)",
    choppy: "hsl(45,100%,50%)",
  };

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-2 sm:p-3 min-w-0 shadow-lg flex flex-col h-full">
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="text-xs font-semibold text-card-foreground">{title}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground mb-1">{total} trading days</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "hsl(0,0%,100%)", fontSize: 11 }} axisLine={{ stroke: "hsl(0,0%,20%)" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "hsl(0,0%,100%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={120}>
              {data.map((entry, i) => <Cell key={i} fill={colorMap[entry.type]} />)}
              <LabelList dataKey="value" position="top" formatter={(v: number) => `${v}%`} style={{ fill: "hsl(0,0%,100%)", fontSize: 14, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-1.5 mt-1 shrink-0">
        <div className="flex-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1 text-center">
          <div className="text-[9px] text-emerald-400 font-medium">bullish</div>
          <div className="text-sm font-bold text-emerald-400">{bullish}</div>
        </div>
        <div className="flex-1 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-1 text-center">
          <div className="text-[9px] text-red-400 font-medium">bearish</div>
          <div className="text-sm font-bold text-red-400">{bearish}</div>
        </div>
        <div className="flex-1 rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-1 text-center">
          <div className="text-[9px] text-yellow-400 font-medium">choppy</div>
          <div className="text-sm font-bold text-yellow-400">{choppy}</div>
        </div>
      </div>
    </div>
  );
};

/** equity curve chart for momentum strategy */
export const EquityCurveChart = ({ data }: { data: { time: string; pnl: number }[] }) => {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg">
      <h3 className="text-xs font-semibold text-card-foreground mb-2">cumulative p&l (equity curve)</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,15%)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "hsl(220,10%,45%)", fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(data.length / 10))} />
            <YAxis tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(1)} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const v = payload[0].value as number;
                return (
                  <div className="rounded-md border border-border bg-[hsl(220,13%,12%)] px-3 py-1.5 text-xs shadow-lg">
                    <span className="text-muted-foreground">trade #{payload[0].payload.time}: </span>
                    <span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>{v >= 0 ? "+" : ""}{v.toFixed(2)}</span>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="pnl" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MomentumChart;
