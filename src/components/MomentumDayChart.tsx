import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aggregateToM15, type CandleBar } from "@/lib/m15-aggregation";
import type { MomentumSignal } from "@/lib/momentum-analysis";

interface MomentumDayChartProps {
  date: string;
  bars: CandleBar[];
  symbol: string;
  momentum: "bullish" | "bearish" | "choppy";
  signals: MomentumSignal[];
  availableDates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const MomentumDayChart = ({ date, bars, symbol, momentum, signals, availableDates, selectedDate, onDateChange }: MomentumDayChartProps) => {
  if (bars.length === 0) return null;

  const displayBars = aggregateToM15(bars);

  const priceMin = Math.min(...displayBars.map(b => b.low));
  const priceMax = Math.max(...displayBars.map(b => b.high));
  const padding = (priceMax - priceMin) * 0.05;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;

  const tickInterval = Math.max(1, Math.floor(displayBars.length / 12));

  // Build highlight set from momentum signals
  const highlightSet = new Set<string>();
  for (const sig of signals) {
    for (const t of sig.times) highlightSet.add(t);
  }

  const momentumBadge = momentum === "bullish"
    ? { text: "🟢 Bullish Momentum", cls: "bg-emerald-500/15 text-emerald-400" }
    : momentum === "bearish"
    ? { text: "🔴 Bearish Momentum", cls: "bg-red-500/15 text-red-400" }
    : { text: "⚪ Choppy / No Momentum", cls: "bg-muted text-muted-foreground" };

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-card-foreground">{symbol}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const idx = availableDates.indexOf(selectedDate);
                if (idx > 0) onDateChange(availableDates[idx - 1]);
              }}
              disabled={availableDates.indexOf(selectedDate) <= 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            >
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
              onClick={() => {
                const idx = availableDates.indexOf(selectedDate);
                if (idx < availableDates.length - 1) onDateChange(availableDates[idx + 1]);
              }}
              disabled={availableDates.indexOf(selectedDate) >= availableDates.length - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${momentumBadge.cls}`}>
            {momentumBadge.text}
          </span>
          {signals.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
              {signals.length} signal(s)
            </span>
          )}
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">M15</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-0.5 bg-yellow-500/50" />
            09:30
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-0.5 bg-red-400/60" />
            12:00
          </span>
          {signals.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 border border-amber-400 border-dashed rounded-sm" />
              Momentum
            </span>
          )}
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayBars} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,15%)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }}
              axisLine={{ stroke: "hsl(220,10%,18%)" }}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              orientation="right"
              tickFormatter={(v) => v.toFixed(2)}
              width={60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as CandleBar;
                if (!d) return null;
                const isUp = d.close >= d.open;
                return (
                  <div className="rounded-md border border-border bg-[hsl(220,13%,12%)] px-3 py-2 text-xs shadow-lg">
                    <div className="text-muted-foreground mb-1">{d.time}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-muted-foreground">O</span>
                      <span className="text-right text-card-foreground">{d.open.toFixed(2)}</span>
                      <span className="text-muted-foreground">H</span>
                      <span className="text-right text-card-foreground">{d.high.toFixed(2)}</span>
                      <span className="text-muted-foreground">L</span>
                      <span className="text-right text-card-foreground">{d.low.toFixed(2)}</span>
                      <span className="text-muted-foreground">C</span>
                      <span className={`text-right ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>{d.close.toFixed(2)}</span>
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine x="09:30" stroke="hsl(45,90%,50%)" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} />
            <ReferenceLine x="12:00" stroke="#f87171" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.6}
              label={{ value: "12:00", position: "top", fill: "#f87171", fontSize: 10 }} />
            <Bar dataKey="high" fill="transparent" isAnimationActive={false} barSize={6}
              shape={(props: any) => {
                const { x, width, payload } = props;
                if (!payload) return <rect />;
                const { open, close, high, low, time } = payload;
                const isUp = close >= open;
                const color = isUp ? "#22c55e" : "#ef4444";
                const yAxisHeight = props.background?.height || 360;
                const range = domainMax - domainMin;
                const toY = (val: number) => {
                  const ratio = (domainMax - val) / range;
                  return (props.background?.y || 0) + ratio * yAxisHeight;
                };
                const wickX = x + width / 2;
                const bodyY = toY(Math.max(open, close));
                const bodyHeight = Math.max(1, toY(Math.min(open, close)) - bodyY);
                const isHighlighted = highlightSet.has(time);
                return (
                  <g>
                    {isHighlighted && (
                      <rect
                        x={x - 3}
                        y={toY(high) - 3}
                        width={width + 6}
                        height={toY(low) - toY(high) + 6}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="3 2"
                        rx={2}
                      />
                    )}
                    <line x1={wickX} y1={toY(high)} x2={wickX} y2={toY(low)} stroke={color} strokeWidth={1} />
                    <rect x={x} y={bodyY} width={width} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} rx={0.5} />
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
