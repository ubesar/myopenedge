import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts";

interface IBChartProps {
  title: string;
  total: number;
  breakHigh: number;
  breakLow: number;
  inside: number;
}

const IBChart = ({ title, total, breakHigh, breakLow, inside }: IBChartProps) => {
  const highPct = total > 0 ? breakHigh / total * 100 : 0;
  const lowPct = total > 0 ? breakLow / total * 100 : 0;
  const insidePct = total > 0 ? inside / total * 100 : 0;

  const data = [
  { name: "Break IB High", value: parseFloat(highPct.toFixed(2)), type: "high" },
  { name: "Break IB Low", value: parseFloat(lowPct.toFixed(2)), type: "low" },
  { name: "Inside Day", value: parseFloat(insidePct.toFixed(2)), type: "inside" }];


  const colorMap: Record<string, string> = {
    high: "hsl(217,91%,60%)",
    low: "hsl(0,0%,35%)",
    inside: "hsl(45,100%,50%)"
  };

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4 flex-1 min-w-[280px] shadow-lg aspect-square flex flex-col">
      <h3 className="text-sm font-semibold text-card-foreground mb-0.5">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">
        {total} trading days analyzed
      </p>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(0,0%,55%)", fontSize: 13 }}
              axisLine={{ stroke: "hsl(0,0%,20%)" }}
              tickLine={false} />

            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(0,0%,55%)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`} />

            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={120}>
              {data.map((entry, i) =>
              <Cell key={i} fill={colorMap[entry.type]} />
              )}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: number) => `${v}%`}
                style={{ fill: "hsl(0,0%,85%)", fontSize: 14, fontWeight: 600 }} />

            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>);

};

export default IBChart;