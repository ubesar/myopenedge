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
    { name: "Break High", value: parseFloat(highPct.toFixed(2)), type: "high" },
    { name: "Break Low", value: parseFloat(lowPct.toFixed(2)), type: "low" },
    { name: "Inside", value: parseFloat(insidePct.toFixed(2)), type: "inside" },
  ];

  const colorMap: Record<string, string> = {
    high: "hsl(142,71%,45%)",
    low: "hsl(0,84%,60%)",
    inside: "hsl(45,100%,50%)",
  };

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-2 sm:p-3 min-w-0 shadow-lg flex flex-col aspect-square h-full">
      <div className="flex items-center gap-1.5 mb-0.5">
        <h3 className="text-[11px] font-semibold text-card-foreground">{title}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground mb-1">{total} trading days</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "hsl(0,0%,55%)", fontSize: 10 }} axisLine={{ stroke: "hsl(0,0%,20%)" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "hsl(0,0%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
              {data.map((entry, i) => (<Cell key={i} fill={colorMap[entry.type]} />))}
              <LabelList dataKey="value" position="top" formatter={(v: number) => `${v}%`} style={{ fill: "hsl(0,0%,85%)", fontSize: 11, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-1 mt-1 shrink-0">
        <div className="flex-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-center">
          <div className="text-[8px] text-emerald-400 font-medium">Break High</div>
          <div className="text-xs font-bold text-emerald-400">{breakHigh}</div>
        </div>
        <div className="flex-1 rounded border border-red-500/30 bg-red-500/10 px-1 py-0.5 text-center">
          <div className="text-[8px] text-red-400 font-medium">Break Low</div>
          <div className="text-xs font-bold text-red-400">{breakLow}</div>
        </div>
        <div className="flex-1 rounded border border-yellow-500/30 bg-yellow-500/10 px-1 py-0.5 text-center">
          <div className="text-[8px] text-yellow-400 font-medium">Inside</div>
          <div className="text-xs font-bold text-yellow-400">{inside}</div>
        </div>
      </div>
    </div>
  );
};

export default IBChart;
