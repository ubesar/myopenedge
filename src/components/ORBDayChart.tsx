import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceArea, ResponsiveContainer, Tooltip, Bar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aggregateToM15, type CandleBar } from "@/lib/m15-aggregation";
import type { ORBDay } from "@/lib/orb-analysis";

interface Props {
  day: ORBDay;
  symbol: string;
  orMinutes: number;
  availableDates: string[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  targetR: number;
}

const ORBDayChart = ({ day, symbol, orMinutes, availableDates, selectedDate, onDateChange, targetR }: Props) => {
  if (!day || day.bars.length === 0) return null;

  const displayBars: CandleBar[] = aggregateToM15(day.bars);
  const target = day.entry != null
    ? (day.direction === "long" ? day.entry + targetR * day.orSize : day.entry - targetR * day.orSize)
    : null;

  const priceMin = Math.min(...displayBars.map((b) => b.low), day.orLow, target ?? day.orLow);
  const priceMax = Math.max(...displayBars.map((b) => b.high), day.orHigh, target ?? day.orHigh);
  const pad = (priceMax - priceMin) * 0.06;
  const domainMin = priceMin - pad;
  const domainMax = priceMax + pad;

  const orEndMinute = 9 * 60 + 30 + orMinutes;
  const orEndLabel = `${String(Math.floor(orEndMinute / 60)).padStart(2, "0")}:${String(orEndMinute % 60).padStart(2, "0")}`;
  const nearestLabel = (t?: string) => {
    if (!t) return undefined;
    const mins = Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]);
    let best = displayBars[0]?.time;
    for (const b of displayBars) {
      const bm = Number(b.time.split(":")[0]) * 60 + Number(b.time.split(":")[1]);
      if (bm <= mins) best = b.time;
    }
    return best;
  };

  const breakoutLabel = nearestLabel(day.breakoutTime);
  const retestLabel = nearestLabel(day.retest?.time);
  const tickInterval = Math.max(1, Math.floor(displayBars.length / 12));
  const isLong = day.direction === "long";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground">{symbol}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { const i = availableDates.indexOf(selectedDate); if (i > 0) onDateChange(availableDates[i - 1]); }}
              disabled={availableDates.indexOf(selectedDate) <= 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            ><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>
            <Select value={selectedDate} onValueChange={onDateChange}>
              <SelectTrigger className="h-7 w-[130px] text-xs bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {[...availableDates].reverse().map((d) => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => { const i = availableDates.indexOf(selectedDate); if (i < availableDates.length - 1) onDateChange(availableDates[i + 1]); }}
              disabled={availableDates.indexOf(selectedDate) >= availableDates.length - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            ><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            day.direction === "long" ? "bg-emerald-500/15 text-emerald-400"
            : day.direction === "short" ? "bg-red-500/15 text-red-400"
            : "bg-muted text-muted-foreground"}`}>
            {day.direction === "none" ? "no breakout" : `${day.direction} breakout ${day.breakoutTime}`}
          </span>
          {day.retest && (
            <span className={`text-[11px] px-2 py-0.5 rounded ${day.retest.continuation ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
              ◆ retest {day.retest.time} (+{day.retest.minutes}m) · {day.retest.continuation ? "continuation" : "failure"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-blue-400" />or high</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-orange-400" />or low</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-emerald-400" />target {targetR}R</span>
          <span>M15</span>
        </div>
      </div>

      <div className="h-[300px] sm:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayBars} barCategoryGap={0} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,15%)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }} axisLine={{ stroke: "hsl(220,10%,18%)" }} tickLine={false} interval={tickInterval} />
            <YAxis domain={[domainMin, domainMax]} tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} orientation="right" tickFormatter={(v) => v.toFixed(2)} width={60} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as CandleBar;
                if (!d) return null;
                const up = d.close >= d.open;
                return (
                  <div className="rounded-md border border-border bg-[hsl(220,13%,12%)] px-3 py-2 text-xs shadow-lg">
                    <div className="text-muted-foreground mb-1">{d.time}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-muted-foreground">O</span><span className="text-right">{d.open.toFixed(2)}</span>
                      <span className="text-muted-foreground">H</span><span className="text-right">{d.high.toFixed(2)}</span>
                      <span className="text-muted-foreground">L</span><span className="text-right">{d.low.toFixed(2)}</span>
                      <span className="text-muted-foreground">C</span><span className={`text-right ${up ? "text-emerald-400" : "text-red-400"}`}>{d.close.toFixed(2)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {/* opening range shading */}
            <ReferenceArea x1={displayBars[0].time} x2={orEndLabel} y1={day.orLow} y2={day.orHigh} fill="#60a5fa" fillOpacity={0.12} stroke="none" />
            <ReferenceLine y={day.orHigh} stroke="#60a5fa" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `OR high ${day.orHigh.toFixed(2)}`, position: "left", fill: "#60a5fa", fontSize: 10 }} />
            <ReferenceLine y={day.orLow} stroke="#fb923c" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `OR low ${day.orLow.toFixed(2)}`, position: "left", fill: "#fb923c", fontSize: 10 }} />
            {target != null && (
              <ReferenceLine y={target} stroke="#34d399" strokeDasharray="4 4" strokeWidth={1}
                label={{ value: `TP ${targetR}R ${target.toFixed(2)}`, position: "left", fill: "#34d399", fontSize: 10 }} />
            )}
            {day.stop != null && (
              <ReferenceLine y={day.stop} stroke="#f87171" strokeDasharray="4 4" strokeWidth={1}
                label={{ value: `SL ${day.stop.toFixed(2)}`, position: "left", fill: "#f87171", fontSize: 10 }} />
            )}
            <ReferenceLine x={orEndLabel} stroke="hsl(45,90%,50%)" strokeDasharray="4 4" strokeOpacity={0.5} />
            {breakoutLabel && (
              <ReferenceLine x={breakoutLabel} stroke={isLong ? "#22c55e" : "#ef4444"} strokeWidth={1}
                label={{ value: isLong ? "▲ breakout" : "▼ breakout", position: "top", fill: isLong ? "#22c55e" : "#ef4444", fontSize: 10 }} />
            )}
            {retestLabel && (
              <ReferenceLine x={retestLabel} stroke="#facc15" strokeDasharray="2 2" strokeWidth={1}
                label={{ value: "◆ retest", position: "insideTopRight", fill: "#facc15", fontSize: 10 }} />
            )}
            <Bar dataKey="high" fill="transparent" isAnimationActive={false} barSize={10}
              shape={(props: any) => {
                const { x, width, payload } = props;
                if (!payload) return <rect />;
                const { open, close, high, low } = payload;
                const up = close >= open;
                const color = up ? "#22c55e" : "#ef4444";
                const h = props.background?.height || 360;
                const range = domainMax - domainMin;
                const toY = (v: number) => (props.background?.y || 0) + ((domainMax - v) / range) * h;
                const wickX = x + width / 2;
                const bodyY = toY(Math.max(open, close));
                const bodyH = Math.max(1, toY(Math.min(open, close)) - bodyY);
                return (
                  <g>
                    <line x1={wickX} y1={toY(high)} x2={wickX} y2={toY(low)} stroke={color} strokeWidth={1} />
                    <rect x={x} y={bodyY} width={width} height={bodyH} fill={color} stroke={color} strokeWidth={0.5} />
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

export default ORBDayChart;
