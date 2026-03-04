import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aggregateBars, type CandleBar } from "@/lib/m15-aggregation";
import type { OCCTimeframeResult, OCCStatus } from "@/lib/occ-analysis";

interface OCCDayChartProps {
  date: string;
  bars: CandleBar[];
  symbol: string;
  timeframes: OCCTimeframeResult[];
  overallBias: OCCStatus;
  availableDates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  tfDirectionStats?: Record<string, {bullishFirst: {total: number;valid: number;invalid: number;};bearishFirst: {total: number;valid: number;invalid: number;};}>;
}

const statusBadge = (status: OCCStatus) => {
  if (status === "bullish") return { text: "🟢 Bullish", cls: "bg-emerald-500/15 text-emerald-400" };
  if (status === "bearish") return { text: "🔴 Bearish", cls: "bg-red-500/15 text-red-400" };
  return { text: "⚪ Failed", cls: "bg-yellow-500/15 text-yellow-400" };
};

const OCCDayChart = ({ date, bars, symbol, timeframes, overallBias, availableDates, selectedDate, onDateChange, tfDirectionStats }: OCCDayChartProps) => {
  if (bars.length === 0) return null;

  const displayBars = aggregateBars(bars, 5); // show M5 for OCC

  const priceMin = Math.min(...displayBars.map((b) => b.low));
  const priceMax = Math.max(...displayBars.map((b) => b.high));
  const padding = (priceMax - priceMin) * 0.05;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;
  const tickInterval = Math.max(1, Math.floor(displayBars.length / 16));

  // Build highlight ranges for each TF's candle1 & candle2
  const highlightMap = new Map<string, string>(); // time -> color
  const tfColors: Record<string, string> = {
    M5: "#60a5fa", // blue
    M15: "#a78bfa", // purple
    M30: "#f97316", // orange
    H1: "#ec4899" // pink
  };

  for (const tf of timeframes) {
    if (tf.candle1 && tf.candle2) {
      // For display, mark candle start times
      highlightMap.set(`${tf.tf}:${tf.candle1.time}`, tfColors[tf.tf] || "#fbbf24");
      highlightMap.set(`${tf.tf}:${tf.candle2.time}`, tfColors[tf.tf] || "#fbbf24");
    }
  }

  const badge = statusBadge(overallBias);

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md p-2 sm:p-3 shadow-lg h-full flex flex-col gap-1.5 my-[115px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badge.cls}`}>{badge.text}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">M5</span>
        </div>
      </div>

      {/* TF Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 shrink-0">
        {timeframes.map((tf) => {
          const b = statusBadge(tf.status);
          const c1 = tf.candle1;
          const c2 = tf.candle2;
          return (
            <div key={tf.tf} className="rounded-md border border-border/30 bg-muted/30 px-2.5 py-2 text-center">
              <div className="text-xs font-bold text-card-foreground" style={{ color: tfColors[tf.tf] }}>{tf.tf}</div>
              <div className={`text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded inline-block ${b.cls}`}>{b.text}</div>
              {c1 && c2 &&
              <div className="text-[9px] text-muted-foreground mt-1">
                  C1: {c1.time} ({c1.close >= c1.open ? "🟢" : "🔴"}) · C2: {c2.time} ({c2.close >= c2.open ? "🟢" : "🔴"})
                </div>
              }
            </div>);

        })}
      </div>

      {/* Chart + Recommendation */}
      <div className="flex gap-2 flex-1 min-h-0">
        <div style={{ width: `min(70%, ${displayBars.length * 10 + 80}px)`, height: '100%', flexShrink: 0 }}>
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
                      <span className={`text-right ${isUp ? "text-emerald-400" : "text-red-400"}`}>{d.close.toFixed(2)}</span>
                    </div>
                  </div>);

                }} />
              
            <Bar
                dataKey="high"
                fill="transparent"
                isAnimationActive={false}
                barSize={4}
                shape={(props: any) => {
                  const { x, width, payload } = props;
                  if (!payload) return <rect />;
                  const { open, close, high, low } = payload;
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
                  return (
                    <g>
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
            const bullishCount = timeframes.filter((tf) => tf.status === "bullish").length;
            const bearishCount = timeframes.filter((tf) => tf.status === "bearish").length;
            const bias = bullishCount > bearishCount ? "Bullish" : bearishCount > bullishCount ? "Bearish" : "Neutral";
            const biasColor = bias === "Bullish" ? "text-emerald-400" : bias === "Bearish" ? "text-red-400" : "text-muted-foreground";
            return (
              <div className="space-y-2.5 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Overall: </span>
                  <span className={`font-bold ${biasColor}`}>{bias}</span>
                  <span className="text-muted-foreground ml-1">({bullishCount}B / {bearishCount}Br / {timeframes.length - bullishCount - bearishCount}F)</span>
                </div>
                <div className="border-t border-border/30 pt-2 space-y-1">
                  <div className="text-muted-foreground font-medium">TF Breakdown</div>
                  {timeframes.map((tf) => {
                    const b = statusBadge(tf.status);
                    const c1Dir = tf.candle1 && tf.candle1.close >= tf.candle1.open ? "Bullish" : "Bearish";
                    return (
                      <div key={tf.tf} className="flex justify-between items-center">
                        <span style={{ color: tfColors[tf.tf] }} className="font-medium">{tf.tf}</span>
                        <span className={`text-[10px] ${b.cls} px-1 rounded`}>{b.text}</span>
                      </div>);

                  })}
                </div>
                {tfDirectionStats &&
                <div className="border-t border-border/30 pt-2 space-y-1">
                    <div className="text-muted-foreground font-medium">Historical Valid %</div>
                    {["M5", "M15", "M30", "H1"].map((tf) => {
                    const s = tfDirectionStats[tf];
                    if (!s) return null;
                    const c1 = timeframes.find((t) => t.tf === tf);
                    const isBullC1 = c1?.candle1 && c1.candle1.close >= c1.candle1.open;
                    const relevant = isBullC1 ? s.bullishFirst : s.bearishFirst;
                    const pct = relevant.total > 0 ? (relevant.valid / relevant.total * 100).toFixed(1) : "—";
                    return (
                      <div key={tf} className="flex justify-between">
                          <span className="text-muted-foreground">{tf} ({isBullC1 ? "Bull" : "Bear"} C1)</span>
                          <span className="text-card-foreground font-medium">{pct}%</span>
                        </div>);

                  })}
                  </div>
                }
              </div>);

          })()}
        </div>
      </div>
    </div>);

};

export default OCCDayChart;