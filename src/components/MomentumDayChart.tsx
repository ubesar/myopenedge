import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aggregateBars, type CandleBar } from "@/lib/m15-aggregation";
import type { MomentumSignal } from "@/lib/momentum-analysis";

interface MomentumStats {
  total: number;
  bullish: number;
  bearish: number;
  choppy: number;
}

interface MomentumDayChartProps {
  date: string;
  bars: CandleBar[];
  symbol: string;
  momentum: "bullish" | "bearish" | "choppy";
  signals: MomentumSignal[];
  availableDates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  statsHighFirst: MomentumStats;
  statsLowFirst: MomentumStats;
  highFirstFormed: boolean;
  selectedTf?: string;
}

const MomentumDayChart = ({ date, bars, symbol, momentum, signals, availableDates, selectedDate, onDateChange, statsHighFirst, statsLowFirst, highFirstFormed, selectedTf = "M15" }: MomentumDayChartProps) => {
  if (bars.length === 0) return null;

  const tfMinutes = selectedTf === "M5" ? 5 : selectedTf === "M30" ? 30 : selectedTf === "H1" ? 60 : 15;
  const displayBars = aggregateBars(bars, tfMinutes);

  const priceMin = Math.min(...displayBars.map((b) => b.low));
  const priceMax = Math.max(...displayBars.map((b) => b.high));
  const padding = (priceMax - priceMin) * 0.05;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;

  const tickInterval = Math.max(1, Math.floor(displayBars.length / 12));

  // Build highlight set from momentum signals
  const highlightSet = new Set<string>();
  for (const sig of signals) {
    for (const t of sig.times) highlightSet.add(t);
  }

  const momentumBadge = momentum === "bullish" ?
  { text: "🟢 Bullish Momentum", cls: "bg-emerald-500/15 text-emerald-400" } :
  momentum === "bearish" ?
  { text: "🔴 Bearish Momentum", cls: "bg-red-500/15 text-red-400" } :
  { text: "⚪ Choppy / No Momentum", cls: "bg-muted text-muted-foreground" };

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 sm:p-4 shadow-lg my-[150px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-sm font-bold text-card-foreground">{symbol}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const idx = availableDates.indexOf(selectedDate);
                if (idx > 0) onDateChange(availableDates[idx - 1]);
              }}
              disabled={availableDates.indexOf(selectedDate) <= 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
              
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <Select value={selectedDate} onValueChange={onDateChange}>
              <SelectTrigger className="h-7 w-[130px] text-xs bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {[...availableDates].reverse().map((d) =>
                <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <button
              onClick={() => {
                const idx = availableDates.indexOf(selectedDate);
                if (idx < availableDates.length - 1) onDateChange(availableDates[idx + 1]);
              }}
              disabled={availableDates.indexOf(selectedDate) >= availableDates.length - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
              
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${momentumBadge.cls}`}>
            {momentumBadge.text}
          </span>
          {signals.length > 0 &&
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
              {signals.length} signal(s)
            </span>
          }
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">{selectedTf}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-0.5 bg-yellow-500/50" />
            09:30
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-0.5 bg-red-400/60" />
            12:00
          </span>
          {signals.length > 0 &&
          <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 border border-amber-400 border-dashed rounded-sm" />
              Momentum
            </span>
          }
        </div>
      </div>
      <div className="flex gap-3 h-[260px] sm:h-[360px]">
        <div style={{ width: `min(70%, ${displayBars.length * 14 + 80}px)`, height: '100%', flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayBars} barCategoryGap={0} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,15%)" vertical={false} />
            <XAxis
                dataKey="time"
                tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }}
                axisLine={{ stroke: "hsl(220,10%,18%)" }}
                tickLine={false}
                interval={tickInterval} />
              
            <YAxis
                domain={[domainMin, domainMax]}
                tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                orientation="right"
                tickFormatter={(v) => v.toFixed(2)}
                width={60} />
              
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
                  </div>);

                }} />
              
            <ReferenceLine x="09:30" stroke="hsl(45,90%,50%)" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} />
            <ReferenceLine x="12:00" stroke="#f87171" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.6}
              label={{ value: "12:00", position: "top", fill: "#f87171", fontSize: 10 }} />
            <Bar dataKey="high" fill="transparent" isAnimationActive={false} barSize={10}
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
                    {isHighlighted &&
                    <rect
                      x={x - 3}
                      y={toY(high) - 3}
                      width={width + 6}
                      height={toY(low) - toY(high) + 6}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      strokeDasharray="3 2"
                      rx={2} />

                    }
                    <line x1={wickX} y1={toY(high)} x2={wickX} y2={toY(low)} stroke={color} strokeWidth={1} />
                    <rect x={x} y={bodyY} width={width} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} rx={0.5} />
                  </g>);

              }} />
              
          </ComposedChart>
        </ResponsiveContainer>
        </div>

        {/* Recommendation Panel */}
        <div className="flex-1 min-w-[180px] rounded-md border border-border/30 bg-muted/20 p-3 overflow-y-auto hidden sm:block">
          <div className="text-xs font-bold text-card-foreground mb-2 flex items-center gap-1.5">📋 Recommendation</div>
          {(() => {
            const stats = highFirstFormed ? statsHighFirst : statsLowFirst;
            const t = stats.total || 1;
            const bullPct = (stats.bullish / t * 100).toFixed(1);
            const bearPct = (stats.bearish / t * 100).toFixed(1);
            const chopPct = (stats.choppy / t * 100).toFixed(1);
            const bias = stats.bullish > stats.bearish ? "Bullish" : stats.bearish > stats.bullish ? "Bearish" : "Neutral";
            const biasColor = bias === "Bullish" ? "text-emerald-400" : bias === "Bearish" ? "text-red-400" : "text-muted-foreground";
            return (
              <div className="space-y-2.5 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Today: </span>
                  <span className="font-semibold text-card-foreground">{highFirstFormed ? "IB High First" : "IB Low First"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Historical ({stats.total} days):</span>
                  <div className="mt-1 space-y-0.5">
                    <div className="flex justify-between"><span className="text-emerald-400">Bullish</span><span className="font-medium text-card-foreground">{bullPct}%</span></div>
                    <div className="flex justify-between"><span className="text-red-400">Bearish</span><span className="font-medium text-card-foreground">{bearPct}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Choppy</span><span className="font-medium text-card-foreground">{chopPct}%</span></div>
                  </div>
                </div>
                <div className="border-t border-border/30 pt-2">
                  <span className="text-muted-foreground">Bias: </span>
                  <span className={`font-bold ${biasColor}`}>{bias}</span>
                </div>
                <div className="border-t border-border/30 pt-2">
                  <span className="text-muted-foreground">Signals: </span>
                  <span className="font-semibold text-card-foreground">{signals.length}</span>
                  {signals.length > 0 &&
                  <div className="mt-1 space-y-0.5">
                      {signals.map((sig, i) =>
                    <div key={i} className={`text-[10px] ${sig.type === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {sig.type === 'bullish' ? '🟢' : '🔴'} {sig.type} @ {sig.times[0]}
                        </div>
                    )}
                    </div>
                  }
                </div>
                <div className="border-t border-border/30 pt-2">
                  <span className="text-muted-foreground">Result: </span>
                  <span className={`font-semibold ${momentum === 'bullish' ? 'text-emerald-400' : momentum === 'bearish' ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {momentum === 'bullish' ? '🟢 Bullish' : momentum === 'bearish' ? '🔴 Bearish' : '⚪ Choppy'}
                  </span>
                </div>
              </div>);

          })()}
        </div>
      </div>
    </div>);

};

export default MomentumDayChart;