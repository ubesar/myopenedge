import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  totalDays: number;
  bars: { name: string; value: number; color: "primary" | "muted" }[];
  legendItems?: { label: string; color: string }[];
  settingsGrid?: { label: string; value: string }[];
}

const ChartCard = ({ title, subtitle, totalDays, bars, legendItems, settingsGrid }: ChartCardProps) => {
  const colorMap = {
    primary: "hsl(217, 91%, 60%)",
    muted: "hsl(240, 5%, 30%)",
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[11px]">
          {totalDays} days
        </span>
      </div>

      {/* Chart */}
      <div className="h-[220px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,10%,14%)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(240,5%,40%)", fontSize: 10 }}
              axisLine={{ stroke: "hsl(240,10%,14%)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(240,5%,40%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {bars.map((entry, i) => (
                <Cell key={i} fill={colorMap[entry.color]} />
              ))}
              <LabelList
                dataKey="value"
                position="inside"
                formatter={(v: number) => `${v.toFixed(1)}%`}
                style={{ fill: "white", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      {legendItems && legendItems.length > 0 && (
        <div className="flex items-center gap-4 mt-2">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Settings grid */}
      {settingsGrid && settingsGrid.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="section-label mb-2">custom settings</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {settingsGrid.map((s) => (
              <div key={s.label} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="text-foreground font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartCard;
