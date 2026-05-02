import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts";
import type { MomentumResult } from "@/lib/momentum-analysis";
import { Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MomentumChartProps {
  result: MomentumResult;
}

const CLASS_META = {
  super_bull: { label: "Super Bull", color: "hsl(142, 90%, 50%)", icon: Zap, badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  super_bear: { label: "Super Bear", color: "hsl(300, 85%, 60%)", icon: Zap, badge: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40" },
  above_bull: { label: "Above Avg Bull", color: "hsl(142, 60%, 38%)", icon: TrendingUp, badge: "bg-emerald-700/20 text-emerald-400 border-emerald-700/40" },
  above_bear: { label: "Above Avg Bear", color: "hsl(0, 70%, 50%)", icon: TrendingDown, badge: "bg-red-500/15 text-red-300 border-red-500/40" },
  below: { label: "Below Avg", color: "hsl(220, 8%, 50%)", icon: Minus, badge: "bg-muted text-muted-foreground border-border" },
} as const;

const MomentumChart = ({ result }: MomentumChartProps) => {
  const { classStats, totalDays, bullishOpens, bearishOpens, weakOpens, superFollowRate, superMult, smaPeriod } = result;

  const distribution = (Object.keys(CLASS_META) as Array<keyof typeof CLASS_META>).map((k) => ({
    name: CLASS_META[k].label,
    key: k,
    count: classStats[k].count,
    pct: parseFloat(classStats[k].pct.toFixed(1)),
    followRate: parseFloat(classStats[k].followRate.toFixed(1)),
    color: CLASS_META[k].color,
  }));

  const bullPct = totalDays ? (bullishOpens / totalDays) * 100 : 0;
  const bearPct = totalDays ? (bearishOpens / totalDays) * 100 : 0;
  const weakPct = totalDays ? (weakOpens / totalDays) * 100 : 0;

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg h-full flex flex-col gap-2 overflow-hidden">
      {/* Header KPI strip */}
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        <Zap className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-card-foreground">Momentum Candle @ NY Open (09:30)</h3>
        <span className="text-[9px] text-muted-foreground ml-auto">
          M15 · SMA{smaPeriod} body · super ≥ {superMult}× · {totalDays} days
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Bull Opens</div>
          <div className="text-sm font-bold text-emerald-400">{bullishOpens}</div>
          <div className="text-[9px] text-emerald-400/70">{bullPct.toFixed(0)}%</div>
        </div>
        <div className="rounded border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Bear Opens</div>
          <div className="text-sm font-bold text-red-400">{bearishOpens}</div>
          <div className="text-[9px] text-red-400/70">{bearPct.toFixed(0)}%</div>
        </div>
        <div className="rounded border border-border/30 bg-muted/30 px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Weak / Below</div>
          <div className="text-sm font-bold text-card-foreground">{weakOpens}</div>
          <div className="text-[9px] text-muted-foreground">{weakPct.toFixed(0)}%</div>
        </div>
        <div className="rounded border border-primary/40 bg-primary/10 px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground uppercase">Super Follow-Through</div>
          <div className={`text-sm font-bold ${superFollowRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
            {superFollowRate.toFixed(0)}%
          </div>
          <div className="text-[9px] text-muted-foreground">to 12:00 ET</div>
        </div>
      </div>

      {/* Direction Bias Bar */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>directional bias</span>
          <span>{bullishOpens}B / {bearishOpens}S / {weakOpens}W</span>
        </div>
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
          {totalDays > 0 && (
            <>
              <div className="h-full bg-emerald-500" style={{ width: `${bullPct}%` }} />
              <div className="h-full bg-muted-foreground/40" style={{ width: `${weakPct}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${bearPct}%` }} />
            </>
          )}
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="flex-1 min-h-0">
        <div className="text-[10px] text-muted-foreground mb-0.5">distribution of opening candle classification</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ top: 12, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "hsl(0,0%,55%)", fontSize: 9 }} axisLine={{ stroke: "hsl(0,0%,18%)" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "hsl(0,0%,55%)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {distribution.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
              <LabelList
                dataKey="pct"
                position="top"
                formatter={(v: number) => `${v}%`}
                style={{ fill: "hsl(0,0%,85%)", fontSize: 10, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-class follow-through table */}
      <div className="grid grid-cols-5 gap-1 shrink-0">
        {distribution.map((d) => {
          const meta = CLASS_META[d.key];
          const Icon = meta.icon;
          return (
            <div key={d.key} className={`rounded border px-1.5 py-1 ${meta.badge}`}>
              <div className="flex items-center gap-0.5">
                <Icon className="h-2.5 w-2.5" />
                <span className="text-[8px] font-semibold uppercase truncate">{meta.label}</span>
              </div>
              <div className="text-[10px] font-bold mt-0.5">{d.count}d ({d.pct}%)</div>
              <div className="text-[8px] text-muted-foreground">
                follow {d.key === "below" ? "—" : `${d.followRate}%`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MomentumChart;
