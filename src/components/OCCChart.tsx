import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts";
import type { OCCDirectionStats } from "@/lib/occ-analysis";

interface OCCChartProps {
  title: string;
  stats: OCCDirectionStats;
  color: "emerald" | "red";
}

const OCCChart = ({ title, stats, color }: OCCChartProps) => {
  const validPct = stats.total > 0 ? (stats.valid / stats.total) * 100 : 0;
  const invalidPct = stats.total > 0 ? (stats.invalid / stats.total) * 100 : 0;

  const data = [
    { name: "Valid", value: parseFloat(validPct.toFixed(1)), type: "valid" },
    { name: "Invalid", value: parseFloat(invalidPct.toFixed(1)), type: "invalid" },
  ];

  const colorMap: Record<string, string> = {
    valid: color === "emerald" ? "hsl(142,71%,45%)" : "hsl(0,84%,60%)",
    invalid: "hsl(220,10%,40%)",
  };

  const borderColor = color === "emerald" ? "border-emerald-500/30" : "border-red-500/30";
  const bgColor = color === "emerald" ? "bg-emerald-500/5" : "bg-red-500/5";
  const iconColor = color === "emerald" ? "text-emerald-400" : "text-red-400";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} backdrop-blur-md p-2 sm:p-3 min-w-0 shadow-lg flex flex-col aspect-square h-full`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-sm ${iconColor}`}>{color === "emerald" ? "🟢" : "🔴"}</span>
        <h3 className="text-[11px] font-semibold text-card-foreground">{title}</h3>
      </div>
      <p className="text-[10px] text-muted-foreground mb-1">{stats.total} days</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="30%">
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
        <div className={`flex-1 rounded border ${color === "emerald" ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"} px-1 py-0.5 text-center`}>
          <div className={`text-[8px] ${iconColor} font-medium`}>Valid</div>
          <div className={`text-xs font-bold ${iconColor}`}>{stats.valid}</div>
        </div>
        <div className="flex-1 rounded border border-border/30 bg-muted/30 px-1 py-0.5 text-center">
          <div className="text-[8px] text-muted-foreground font-medium">Invalid</div>
          <div className="text-xs font-bold text-muted-foreground">{stats.invalid}</div>
        </div>
      </div>
    </div>
  );
};

export default OCCChart;
