import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CandleBar } from "@/lib/m15-aggregation";
import type { MomentumTrade } from "@/lib/momentum-analysis";

interface MomentumDayChartProps {
  date: string;
  bars: CandleBar[];
  symbol: string;
  ibHigh: number;
  ibLow: number;
  highFirstFormed: boolean;
  trades: MomentumTrade[];
  dayPnl: number;
  availableDates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  ibWindowMinutes: number;
}

const MomentumDayChart = ({
  date, bars, symbol, ibHigh, ibLow, highFirstFormed,
  trades, dayPnl, availableDates, selectedDate, onDateChange, ibWindowMinutes,
}: MomentumDayChartProps) => {
  if (bars.length === 0) return null;

  const priceMin = Math.min(...bars.map((b) => b.low));
  const priceMax = Math.max(...bars.map((b) => b.high));
  const padding = (priceMax - priceMin) * 0.05;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;
  const tickInterval = Math.max(1, Math.floor(bars.length / 12));

  // Build entry/exit time sets
  const entryTimes = new Map<string, MomentumTrade>();
  const exitTimes = new Map<string, MomentumTrade>();
  for (const t of trades) {
    entryTimes.set(t.entryTime, t);
    exitTimes.set(t.exitTime, t);
  }

  // IB end time
  const ibEndH = Math.floor((9 * 60 + 30 + ibWindowMinutes) / 60);
  const ibEndM = (9 * 60 + 30 + ibWindowMinutes) % 60;
  const ibEndTime = `${String(ibEndH).padStart(2, "0")}:${String(ibEndM).padStart(2, "0")}`;

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
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${highFirstFormed ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
            {highFirstFormed ? "IB High First" : "IB Low First"}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${dayPnl >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
            p&l: ${dayPnl.toFixed(2)}
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {trades.length} trade(s)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-400/60" /> IB Range
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 bg-emerald-500 rounded-sm" /> Buy Entry
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 bg-red-500 rounded-sm" /> Sell Entry
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-amber-400 rounded-sm" /> Exit
          </span>
        </div>
      </div>

      {/* Chart + Trades Panel */}
      <div className="flex-1 min-h-0 flex gap-3">
        <div className="flex-1 min-w-0">
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
              {/* IB Range */}
              <ReferenceLine y={ibHigh} stroke="#60a5fa" strokeDasharray="6 3" strokeWidth={1} strokeOpacity={0.7} label={{ value: `IB H ${ibHigh.toFixed(2)}`, position: "right", fill: "#60a5fa", fontSize: 9 }} />
              <ReferenceLine y={ibLow} stroke="#60a5fa" strokeDasharray="6 3" strokeWidth={1} strokeOpacity={0.7} label={{ value: `IB L ${ibLow.toFixed(2)}`, position: "right", fill: "#60a5fa", fontSize: 9 }} />
              {/* IB End vertical line */}
              <ReferenceLine x={ibEndTime} stroke="#fbbf24" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} />

              <Bar dataKey="high" fill="transparent" isAnimationActive={false} barSize={8}
                shape={(props: any) => {
                  const { x, width, payload } = props;
                  if (!payload) return <rect />;
                  const { open, close, high, low, time } = payload;
                  const isUp = close >= open;
                  const color = isUp ? "#22c55e" : "#ef4444";
                  const yAxisHeight = props.background?.height || 360;
                  const range = domainMax - domainMin;
                  const toY = (val: number) => (props.background?.y || 0) + ((domainMax - val) / range) * yAxisHeight;
                  const wickX = x + width / 2;
                  const bodyY = toY(Math.max(open, close));
                  const bodyHeight = Math.max(1, toY(Math.min(open, close)) - bodyY);

                  const isEntry = entryTimes.has(time);
                  const isExit = exitTimes.has(time);
                  const entryTrade = entryTimes.get(time);

                  return (
                    <g>
                      {/* Entry marker */}
                      {isEntry && (
                        <polygon
                          points={
                            entryTrade?.direction === "buy"
                              ? `${wickX},${toY(low) + 8} ${wickX - 4},${toY(low) + 14} ${wickX + 4},${toY(low) + 14}`
                              : `${wickX},${toY(high) - 8} ${wickX - 4},${toY(high) - 14} ${wickX + 4},${toY(high) - 14}`
                          }
                          fill={entryTrade?.direction === "buy" ? "#22c55e" : "#ef4444"}
                        />
                      )}
                      {/* Exit marker */}
                      {isExit && (
                        <rect
                          x={x - 2} y={toY(high) - 4}
                          width={width + 4} height={toY(low) - toY(high) + 8}
                          fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="3 2" rx={2}
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

        {/* Trades Log Panel */}
        <div className="w-[200px] rounded-md border border-border/30 bg-muted/20 p-2 overflow-y-auto hidden sm:block">
          <div className="text-[10px] font-bold text-card-foreground mb-1.5">📋 trades log</div>
          {trades.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">no trades this day</p>
          ) : (
            <div className="space-y-1.5">
              {trades.map((t, i) => (
                <div key={i} className={`rounded border px-1.5 py-1 text-[10px] ${t.pnl >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <div className="flex justify-between">
                    <span className={t.direction === "buy" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                      {t.direction === "buy" ? "▲ buy" : "▼ sell"}
                    </span>
                    <span className={t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {t.entryTime} → {t.exitTime} ({t.exitReason.toUpperCase()})
                  </div>
                  <div className="text-muted-foreground">
                    ${t.entryPrice.toFixed(2)} → ${t.exitPrice.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MomentumDayChart;
