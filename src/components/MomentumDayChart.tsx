import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aggregateBars, type CandleBar } from "@/lib/m15-aggregation";
import type { MomentumTrade } from "@/lib/momentum-analysis";

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
  trades: MomentumTrade[];
  availableDates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  statsHighFirst: MomentumStats;
  statsLowFirst: MomentumStats;
  highFirstFormed: boolean;
  selectedTf?: string;
}

const MomentumDayChart = ({ date, bars, symbol, momentum, trades, availableDates, selectedDate, onDateChange, statsHighFirst, statsLowFirst, highFirstFormed, selectedTf = "M15" }: MomentumDayChartProps) => {
  if (bars.length === 0) return null;

  const tfMinutes = selectedTf === "M5" ? 5 : selectedTf === "M30" ? 30 : selectedTf === "H1" ? 60 : 15;
  const displayBars = aggregateBars(bars, tfMinutes);

  const priceMin = Math.min(...displayBars.map((b) => b.low));
  const priceMax = Math.max(...displayBars.map((b) => b.high));
  const padding = (priceMax - priceMin) * 0.05;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;

  const tickInterval = Math.max(1, Math.floor(displayBars.length / 12));

  // Build highlight set from trade entry/exit times
  const entrySet = new Set<string>();
  const exitSet = new Set<string>();
  for (const t of trades) {
    entrySet.add(t.entryTime);
    exitSet.add(t.exitTime);
  }

  const momentumBadge = momentum === "bullish" ?
  { text: "🟢 bullish momentum", cls: "bg-emerald-500/15 text-emerald-400" } :
  momentum === "bearish" ?
  { text: "🔴 bearish momentum", cls: "bg-red-500/15 text-red-400" } :
  { text: "⚪ choppy / no momentum", cls: "bg-muted text-muted-foreground" };

  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const dayWins = trades.filter(t => t.isWin).length;

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-3 sm:p-4 shadow-lg my-0">
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
          {trades.length > 0 &&
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
              {trades.length} trade(s)
            </span>
          }
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">{selectedTf}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
            entry
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-orange-500" />
            exit
          </span>
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
                const isEntry = entrySet.has(time);
                const isExit = exitSet.has(time);
                return (
                  <g>
                    {isEntry &&
                    <circle cx={wickX} cy={toY(high) - 8} r={4} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1} />
                    }
                    {isExit &&
                    <circle cx={wickX} cy={toY(low) + 8} r={4} fill="#f97316" stroke="#c2410c" strokeWidth={1} />
                    }
                    <line x1={wickX} y1={toY(high)} x2={wickX} y2={toY(low)} stroke={color} strokeWidth={1} />
                    <rect x={x} y={bodyY} width={width} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} rx={0.5} />
                  </g>);
              }} />
          </ComposedChart>
        </ResponsiveContainer>
        </div>

        {/* Trade Log Panel */}
        <div className="flex-1 min-w-[180px] rounded-md border border-border/30 bg-muted/20 p-3 overflow-y-auto hidden sm:block">
          <div className="text-xs font-bold text-card-foreground mb-2 flex items-center gap-1.5">📋 trade log</div>
          <div className="space-y-2.5 text-[11px]">
            <div>
              <span className="text-muted-foreground">trades: </span>
              <span className="font-semibold text-card-foreground">{trades.length}</span>
              <span className="text-muted-foreground ml-2">wins: </span>
              <span className="font-semibold text-emerald-400">{dayWins}</span>
              <span className="text-muted-foreground ml-2">losses: </span>
              <span className="font-semibold text-red-400">{trades.length - dayWins}</span>
            </div>
            <div>
              <span className="text-muted-foreground">day p&l: </span>
              <span className={`font-bold ${dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {dayPnl >= 0 ? '+' : ''}{dayPnl.toFixed(2)}
              </span>
            </div>
            <div className="border-t border-border/30 pt-2 space-y-1.5">
              {trades.map((t, i) => (
                <div key={i} className="flex flex-col gap-0.5 pb-1.5 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.direction === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {t.direction}
                    </span>
                    <span className="text-muted-foreground">{t.entryTime} → {t.exitTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">entry: {t.entryPrice.toFixed(2)}</span>
                    <span className="text-muted-foreground">exit: {t.exitPrice.toFixed(2)}</span>
                    <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                      t.exitReason === 'tp' ? 'bg-emerald-500/20 text-emerald-400' :
                      t.exitReason === 'sl' ? 'bg-red-500/20 text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {t.exitReason}
                    </span>
                    <span className={`font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              {trades.length === 0 && (
                <p className="text-muted-foreground text-[10px]">no trades on this day</p>
              )}
            </div>
            <div className="border-t border-border/30 pt-2">
              <span className="text-muted-foreground">result: </span>
              <span className={`font-semibold ${momentum === 'bullish' ? 'text-emerald-400' : momentum === 'bearish' ? 'text-red-400' : 'text-muted-foreground'}`}>
                {momentum === 'bullish' ? '🟢 bullish' : momentum === 'bearish' ? '🔴 bearish' : '⚪ choppy'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>);
};

export default MomentumDayChart;
