import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CandleBar } from "@/lib/m15-aggregation";
import type { MomentumClass } from "@/lib/momentum-analysis";

interface MomentumDayChartProps {
  date: string;
  bars: CandleBar[];
  symbol: string;
  // Open candle metadata
  openCandle?: CandleBar;
  classification?: MomentumClass;
  bodyRatio?: number;
  avgBody?: number;
  body?: number;
  netMove?: number;
  confirmed?: boolean | null;
  // Backward-compat (tetap diterima tapi tidak dipakai untuk overlay trade lama)
  ibHigh?: number;
  ibLow?: number;
  highFirstFormed?: boolean;
  trades?: unknown[];
  dayPnl?: number;
  ibWindowMinutes?: number;
  // Navigation
  availableDates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const CLASS_LABEL: Record<MomentumClass, { label: string; color: string; badge: string }> = {
  super_bull: { label: "Super Bull (Lime)", color: "#22ff66", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  super_bear: { label: "Super Bear (Magenta)", color: "#e040fb", badge: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" },
  above_bull: { label: "Above Avg Bull", color: "#16a34a", badge: "bg-emerald-700/20 text-emerald-400 border-emerald-700/40" },
  above_bear: { label: "Above Avg Bear", color: "#dc2626", badge: "bg-red-500/20 text-red-300 border-red-500/40" },
  below: { label: "Below Avg (Weak)", color: "#9ca3af", badge: "bg-muted text-muted-foreground border-border" },
  none: { label: "Insufficient Data", color: "#6b7280", badge: "bg-muted text-muted-foreground border-border" },
};

const MomentumDayChart = ({
  date, bars, symbol,
  classification = "none", bodyRatio = 0, avgBody = 0, body = 0, netMove = 0, confirmed,
  availableDates, selectedDate, onDateChange,
}: MomentumDayChartProps) => {
  if (bars.length === 0) return null;

  const priceMin = Math.min(...bars.map((b) => b.low));
  const priceMax = Math.max(...bars.map((b) => b.high));
  const padding = (priceMax - priceMin) * 0.05 || 1;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;
  const tickInterval = Math.max(1, Math.floor(bars.length / 12));

  const meta = CLASS_LABEL[classification];

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-card-foreground">{symbol}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { const idx = availableDates.indexOf(selectedDate); if (idx > 0) onDateChange(availableDates[idx - 1]); }}
              disabled={availableDates.indexOf(selectedDate) <= 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <Select value={selectedDate} onValueChange={onDateChange}>
              <SelectTrigger className="h-7 w-[130px] text-xs bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {[...availableDates].reverse().map((d) => (
                  <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => { const idx = availableDates.indexOf(selectedDate); if (idx < availableDates.length - 1) onDateChange(availableDates[idx + 1]); }}
              disabled={availableDates.indexOf(selectedDate) >= availableDates.length - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.badge}`}>
            {(classification === "super_bull" || classification === "super_bear") && <Zap className="h-3 w-3" />}
            {meta.label}
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
            body × {bodyRatio.toFixed(2)} avg
          </span>
          {confirmed !== null && confirmed !== undefined && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${confirmed ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
              follow-through: {confirmed ? "confirmed ✓" : "failed ✗"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <span className="text-muted-foreground">body ${body.toFixed(2)} · avg ${avgBody.toFixed(2)}</span>
          <span className={`font-semibold ${netMove >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            net move ${netMove.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={bars} barCategoryGap={0} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,15%)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }} axisLine={{ stroke: "hsl(220,10%,18%)" }} tickLine={false} interval={tickInterval} />
            <YAxis domain={[domainMin, domainMax]} tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} orientation="right" tickFormatter={(v) => v.toFixed(2)} width={60} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as CandleBar;
                if (!d) return null;
                const isUp = d.close >= d.open;
                return (
                  <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
                    <div className="text-muted-foreground mb-1">{d.time}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-muted-foreground">O</span><span className="text-right">{d.open.toFixed(2)}</span>
                      <span className="text-muted-foreground">H</span><span className="text-right">{d.high.toFixed(2)}</span>
                      <span className="text-muted-foreground">L</span><span className="text-right">{d.low.toFixed(2)}</span>
                      <span className="text-muted-foreground">C</span><span className={`text-right ${isUp ? "text-emerald-400" : "text-red-400"}`}>{d.close.toFixed(2)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {/* 09:30 vertical marker */}
            <ReferenceLine x="09:30" stroke={meta.color} strokeDasharray="4 3" strokeWidth={1.2} strokeOpacity={0.7}
              label={{ value: "NY Open", position: "insideTopLeft", fill: meta.color, fontSize: 10 }} />
            {/* 12:00 (end of follow-through window) */}
            <ReferenceLine x="12:00" stroke="#fbbf24" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.4}
              label={{ value: "12:00", position: "insideTopRight", fill: "#fbbf24", fontSize: 9 }} />

            <Bar dataKey="high" fill="transparent" isAnimationActive={false} barSize={8}
              shape={(props: any) => {
                const { x, width, payload } = props;
                if (!payload) return <rect />;
                const { open, close, high, low, time } = payload;
                const isUp = close >= open;
                const isOpenCandle = time === "09:30";
                let color = isUp ? "#22c55e" : "#ef4444";
                if (isOpenCandle) color = meta.color;

                const yAxisHeight = props.background?.height || 360;
                const range = domainMax - domainMin;
                const toY = (val: number) => (props.background?.y || 0) + ((domainMax - val) / range) * yAxisHeight;
                const wickX = x + width / 2;
                const bodyY = toY(Math.max(open, close));
                const bodyHeight = Math.max(1, toY(Math.min(open, close)) - bodyY);

                return (
                  <g>
                    <line x1={wickX} y1={toY(high)} x2={wickX} y2={toY(low)} stroke={color} strokeWidth={isOpenCandle ? 1.5 : 1} />
                    <rect
                      x={x} y={bodyY} width={width} height={bodyHeight}
                      fill={color}
                      stroke={isOpenCandle ? "#ffffff" : color}
                      strokeWidth={isOpenCandle ? 1.5 : 0.5}
                      rx={0.5}
                    />
                    {isOpenCandle && (classification === "super_bull" || classification === "super_bear") && (
                      <circle cx={wickX} cy={toY(high) - 8} r={3} fill={meta.color} />
                    )}
                  </g>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MomentumDayChart;
