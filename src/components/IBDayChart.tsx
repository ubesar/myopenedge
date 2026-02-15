import { ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Bar, Cell } from "recharts";
import type { CandleBar } from "@/lib/ib-analysis";

interface IBDayChartProps {
  date: string;
  bars: CandleBar[];
  ibHigh: number;
  ibLow: number;
  symbol: string;
  ibWindowMinutes: number;
}

// Custom candlestick shape
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;

  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#22c55e" : "#ef4444";
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);

  // We need to compute pixel positions from the YAxis scale
  const yScale = props.yScale || props.background?.yScale;

  // Use the bar's y and height to derive scale
  // Actually, recharts passes x, y, width, height for the bar
  // We'll use a custom approach with the raw SVG

  return null; // We'll use a custom layer instead
};

const IBDayChart = ({ date, bars, ibHigh, ibLow, symbol, ibWindowMinutes }: IBDayChartProps) => {
  if (bars.length === 0) return null;

  const priceMin = Math.min(...bars.map(b => b.low));
  const priceMax = Math.max(...bars.map(b => b.high));
  const padding = (priceMax - priceMin) * 0.05;
  const domainMin = priceMin - padding;
  const domainMax = priceMax + padding;

  // IB end time label
  const ibEndMinute = 9 * 60 + 30 + ibWindowMinutes;
  const ibEndH = Math.floor(ibEndMinute / 60);
  const ibEndM = ibEndMinute % 60;
  const ibEndLabel = `${ibEndH.toString().padStart(2, '0')}:${ibEndM.toString().padStart(2, '0')}`;

  // Show every Nth label to avoid crowding
  const tickInterval = Math.max(1, Math.floor(bars.length / 12));

  return (
    <div className="rounded-lg border border-border bg-[hsl(220,13%,8%)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-card-foreground">{symbol}</span>
          <span className="text-xs text-muted-foreground">· 5 min · {date}</span>
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
            <span className="inline-block h-4 w-0.5 bg-yellow-500/50" />
            IB End
          </span>
        </div>
      </div>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={bars}
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
