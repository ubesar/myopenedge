import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts";

interface IBChartProps {
  title: string;
  total: number;
  breakHigh: number;
  breakLow: number;
}

const IBChart = ({ title, total, breakHigh, breakLow }: IBChartProps) => {
  const highPct = total > 0 ? (breakHigh / total) * 100 : 0;
  const lowPct = total > 0 ? (breakLow / total) * 100 : 0;

  const data = [
    { name: "Break IB High", value: parseFloat(highPct.toFixed(2)), type: "high" },
    { name: "Break IB Low", value: parseFloat(lowPct.toFixed(2)), type: "low" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex-1 min-w-[280px]">
      <h3 className="text-sm font-semibold text-card-foreground mb-0.5">{title}</h3>
      <p className="text-xs text-muted-foreground mb-2">
        {total} trading days analyzed
      </p>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(0,0%,55%)", fontSize: 13 }}
              axisLine={{ stroke: "hsl(0,0%,20%)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(0,0%,55%)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.type === "high" ? "hsl(217,91%,60%)" : "hsl(0,0%,35%)"}
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: number) => `${v}%`}
                style={{ fill: "hsl(0,0%,85%)", fontSize: 14, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default IBChart;
