import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts";

interface OCCChartProps {
  title: string;
  total: number;
  bullish: number;
  bearish: number;
  failed: number;
}

const OCCChart = ({ title, total, bullish, bearish, failed }: OCCChartProps) => {
  const bullPct = total > 0 ? (bullish / total) * 100 : 0;
  const bearPct = total > 0 ? (bearish / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;

  const data = [
    { name: "Bullish", value: parseFloat(bullPct.toFixed(2)), type: "bullish" },
    { name: "Bearish", value: parseFloat(bearPct.toFixed(2)), type: "bearish" },
    { name: "Failed", value: parseFloat(failedPct.toFixed(2)), type: "failed" },
  ];

  const colorMap: Record<string, string> = {
    bullish: "hsl(142,71%,45%)",
    bearish: "hsl(0,84%,60%)",
    failed: "hsl(45,100%,50%)",
  };

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4 flex-1 min-w-[220px] shadow-lg flex flex-col">
      <h3 className="text-sm font-semibold text-card-foreground mb-0.5">{title}</h3>
      <p className="text-xs text-muted-foreground mb-2">{total} days</p>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(0,0%,55%)", fontSize: 12 }}
              axisLine={{ stroke: "hsl(0,0%,20%)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(0,0%,55%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
              {data.map((entry, i) => (
                <Cell key={i} fill={colorMap[entry.type]} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: number) => `${v}%`}
                style={{ fill: "hsl(0,0%,85%)", fontSize: 13, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-2 mt-2">
        <div className="flex-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-center">
          <div className="text-[10px] text-emerald-400 font-medium">Bullish</div>
          <div className="text-base font-bold text-emerald-400">{bullish}</div>
        </div>
        <div className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-center">
          <div className="text-[10px] text-red-400 font-medium">Bearish</div>
          <div className="text-base font-bold text-red-400">{bearish}</div>
        </div>
        <div className="flex-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-center">
          <div className="text-[10px] text-yellow-400 font-medium">Failed</div>
          <div className="text-base font-bold text-yellow-400">{failed}</div>
        </div>
      </div>
    </div>
  );
};

export default OCCChart;
