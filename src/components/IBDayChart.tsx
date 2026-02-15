import { useState } from "react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Bar } from "recharts";
import type { CandleBar } from "@/lib/ib-analysis";

interface IBDayChartProps {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  symbol: string;
  ibWindowMinutes: number;
}

const TIMEFRAMES = [
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "60m" },
];

function aggregateBars(bars: CandleBar[], tfMinutes: number): CandleBar[] {
  if (tfMinutes <= 5) return bars;

  const groups: CandleBar[][] = [];
  let current: CandleBar[] = [];

  for (const bar of bars) {
    const [h, m] = bar.time.split(":").map(Number);
    const totalMin = h * 60 + m;
    // Group by floored interval
    if (current.length > 0) {
      const [fh, fm] = current[0].time.split(":").map(Number);
      const firstMin = fh * 60 + fm;
      if (totalMin - firstMin >= tfMinutes) {
        groups.push(current);
        current = [];
      }
    }
    current.push(bar);
  }
  if (current.length > 0) groups.push(current);

  return groups.map((g) => ({
    time: g[0].time,
    open: g[0].open,
    high: Math.max(...g.map((b) => b.high)),
    low: Math.min(...g.map((b) => b.low)),
    close: g[g.length - 1].close,
  }));
}

const IBDayChart = ({ date, bars, ibHigh, ibLow, symbol, ibWindowMinutes }: IBDayChartProps) => {
  const [timeframe, setTimeframe] = useState(5);

  if (bars.length === 0) return null;

  const displayBars = aggregateBars(bars, timeframe);

  const priceMin = Math.min(...displayBars.map(b => b.low));
  const priceMax = Math.max(...displayBars.map(b => b.high));
  const padding = (priceMax - priceMin) * 0.05;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;

  const ibEndMinute = 9 * 60 + 30 + ibWindowMinutes;
  const ibEndH = Math.floor(ibEndMinute / 60);
  const ibEndM = ibEndMinute % 60;
  const ibEndLabel = `${ibEndH.toString().padStart(2, '0')}:${ibEndM.toString().padStart(2, '0')}`;

  const tickInterval = Math.max(1, Math.floor(displayBars.length / 12));

  return (
    <div className="rounded-lg border border-border bg-[hsl(220,13%,8%)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-card-foreground">{symbol}</span>
          <span className="text-xs text-muted-foreground">· {date}</span>
          <div className="flex items-center gap-1 ml-2">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  timeframe === tf.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-400" />
            IB High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-orange-400" />
            IB Low
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-green-400" />
            IB50
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-0.5 bg-yellow-500/50" />
            IB End
          </span>
        </div>
      </div>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayBars}
            margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220,10%,15%)"
              vertical={false}
            />
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
              contentStyle={{
                backgroundColor: "hsl(220,13%,12%)",
                border: "1px solid hsl(220,10%,20%)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(220,10%,70%)" }}
              formatter={(value: number, name: string) => [value.toFixed(2), name]}
              content={({ active, payload, label }) => {
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

            {/* IB High reference line */}
            <ReferenceLine
              y={ibHigh}
              stroke="#60a5fa"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `IB High ${ibHigh.toFixed(2)}`,
                position: "left",
                fill: "#60a5fa",
                fontSize: 10,
              }}
            />

            {/* IB Low reference line */}
            <ReferenceLine
              y={ibLow}
              stroke="#fb923c"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `IB Low ${ibLow.toFixed(2)}`,
                position: "left",
                fill: "#fb923c",
                fontSize: 10,
              }}
            />

            {/* IB 50% reference line */}
            <ReferenceLine
              y={(ibHigh + ibLow) / 2}
              stroke="#4ade80"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `IB50 ${((ibHigh + ibLow) / 2).toFixed(2)}`,
                position: "left",
                fill: "#4ade80",
                fontSize: 10,
              }}
            />

            {/* IB End vertical line */}
            <ReferenceLine
              x={ibEndLabel}
              stroke="hsl(45,90%,50%)"
              strokeDasharray="4 4"
              strokeWidth={1}
              strokeOpacity={0.5}
            />

            {/* Invisible bar for hover/tooltip area */}
            <Bar dataKey="high" fill="transparent" isAnimationActive={false} barSize={6}
              shape={(props: any) => {
                const { x, y, width, payload, background } = props;
                if (!payload) return <rect />;
                const { open, close, high, low } = payload;
                const isUp = close >= open;
                const color = isUp ? "#22c55e" : "#ef4444";

                // Calculate Y positions using the YAxis domain
                const chartHeight = 400 - 10 - 0; // approx usable height
                const yAxisHeight = props.background?.height || 360;

                // Use the y coordinate system from recharts
                // props.y is the Y pixel position for "high" value
                // We need a scale function
                const range = domainMax - domainMin;
                const plotArea = yAxisHeight;
                const toY = (val: number) => {
                  const ratio = (domainMax - val) / range;
                  return props.background?.y + ratio * plotArea;
                };

                const wickX = x + width / 2;
                const bodyY = toY(Math.max(open, close));
                const bodyHeight = Math.max(1, toY(Math.min(open, close)) - bodyY);
                const wickTop = toY(high);
                const wickBottom = toY(low);

                return (
                  <g>
                    {/* Wick */}
                    <line
                      x1={wickX}
                      y1={wickTop}
                      x2={wickX}
                      y2={wickBottom}
                      stroke={color}
                      strokeWidth={1}
                    />
                    {/* Body */}
                    <rect
                      x={x}
                      y={bodyY}
                      width={width}
                      height={bodyHeight}
                      fill={isUp ? color : color}
                      stroke={color}
                      strokeWidth={0.5}
                      rx={0.5}
                    />
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

export default IBDayChart;
