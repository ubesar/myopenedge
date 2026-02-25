import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts";

interface OCCChartProps {
  title: string;
  total: number;
  bullish: number;
  bearish: number;
  failed: number;
  c1BullishTotal: number;
  c1BullishValid: number;
  c1BearishTotal: number;
  c1BearishValid: number;
}

const OCCChart = ({ title, total, c1BullishTotal, c1BullishValid, c1BearishTotal, c1BearishValid }: OCCChartProps) => {
  const bullValidPct = c1BullishTotal > 0 ? parseFloat(((c1BullishValid / c1BullishTotal) * 100).toFixed(1)) : 0;
  const bullInvalidPct = c1BullishTotal > 0 ? parseFloat((((c1BullishTotal - c1BullishValid) / c1BullishTotal) * 100).toFixed(1)) : 0;
  const bearValidPct = c1BearishTotal > 0 ? parseFloat(((c1BearishValid / c1BearishTotal) * 100).toFixed(1)) : 0;
  const bearInvalidPct = c1BearishTotal > 0 ? parseFloat((((c1BearishTotal - c1BearishValid) / c1BearishTotal) * 100).toFixed(1)) : 0;

  const data = [
    { name: "Bull Valid", value: bullValidPct, color: "hsl(142,71%,45%)" },
    { name: "Bull Invalid", value: bullInvalidPct, color: "hsl(0,84%,60%)" },
    { name: "Bear Valid", value: bearValidPct, color: "hsl(142,71%,45%)" },
    { name: "Bear Invalid", value: bearInvalidPct, color: "hsl(0,84%,60%)" },
  ];

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4 flex-1 min-w-[220px] shadow-lg flex flex-col">
      <h3 className="text-sm font-semibold text-card-foreground mb-0.5">{title}</h3>
      <p className="text-xs text-muted-foreground mb-2">{total} days</p>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(0,0%,55%)", fontSize: 10 }}
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
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: number) => `${v}%`}
                style={{ fill: "hsl(0,0%,85%)", fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-2 mt-2">
        <div className="flex-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-center">
          <div className="text-[10px] text-emerald-400 font-medium">1st Bullish</div>
          <div className="text-xs text-muted-foreground">{c1BullishValid}/{c1BullishTotal} valid</div>
        </div>
        <div className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-center">
          <div className="text-[10px] text-red-400 font-medium">1st Bearish</div>
          <div className="text-xs text-muted-foreground">{c1BearishValid}/{c1BearishTotal} valid</div>
        </div>
      </div>
    </div>
  );
};

export default OCCChart;
