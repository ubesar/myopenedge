import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aggregateBars, type CandleBar } from "@/lib/m15-aggregation";
import type { MomentumTrade } from "@/lib/momentum-analysis";

interface RawBar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

interface Props {
  bars: RawBar[];
  trades: MomentumTrade[];
  symbol: string;
}

const IB_START = 9 * 60 + 30;
const MARKET_CLOSE = 16 * 60;

const parseTimeMin = (dt: string) => {
  const t = dt.split(" ")[1] || "00:00:00";
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Treat NY datetime as a fixed clock — encode to UTC seconds so the chart's
// time axis displays the original NY hours regardless of the viewer's TZ.
const toChartTime = (dt: string): UTCTimestamp => {
  const [d, t] = dt.split(" ");
  return (Date.parse(`${d}T${t || "00:00:00"}Z`) / 1000) as UTCTimestamp;
};

const MomentumCandleChart = ({ bars, trades, symbol }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Available session days (those with at least one RTH bar)
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const b of bars) {
      const m = parseTimeMin(b.datetime);
      if (m >= IB_START && m < MARKET_CLOSE) {
        set.add(b.datetime.split(" ")[0]);
      }
    }
    return Array.from(set).sort().reverse();
  }, [bars]);

  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (availableDates.length && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  // Build M15 bars for the selected day
  const dayCandles = useMemo<CandleBar[]>(() => {
    if (!selectedDate) return [];
    const dayBars = bars
      .filter((b) => {
        if (!b.datetime.startsWith(selectedDate)) return false;
        const m = parseTimeMin(b.datetime);
        return m >= IB_START && m < MARKET_CLOSE;
      })
      .sort((a, b) => a.datetime.localeCompare(b.datetime));

    const m5: CandleBar[] = dayBars.map((b) => ({
      time: b.datetime.split(" ")[1].slice(0, 5),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
    }));
    return aggregateBars(m5, 15);
  }, [bars, selectedDate]);

  const dayTrades = useMemo(
    () => trades.filter((t) => t.date === selectedDate),
    [trades, selectedDate]
  );

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(var(--muted-foreground))",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(var(--border) / 0.3)" },
        horzLines: { color: "hsl(var(--border) / 0.3)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "hsl(var(--border))" },
      timeScale: {
        borderColor: "hsl(var(--border))",
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update candles + trade levels
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    // Clear prior price lines
    priceLinesRef.current.forEach((pl) => series.removePriceLine(pl));
    priceLinesRef.current = [];

    if (!dayCandles.length || !selectedDate) {
      series.setData([]);
      return;
    }

    series.setData(
      dayCandles.map((c) => ({
        time: toChartTime(`${selectedDate} ${c.time}:00`),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    dayTrades.forEach((t, idx) => {
      const tag = `#${idx + 1} ${t.direction === "bullish" ? "▲" : "▼"} ${t.entryTime}`;
      const lines: Array<{ price: number; color: string; title: string }> = [
        { price: t.entry, color: "#3b82f6", title: `${tag} entry` },
        { price: t.tp50, color: "#22c55e", title: `${tag} tp50` },
        { price: t.slFull, color: "#ef4444", title: `${tag} sl full` },
        { price: t.slHalf, color: "#f59e0b", title: `${tag} sl half` },
      ];
      lines.forEach((l) => {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: l.price,
            color: l.color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: l.title,
          })
        );
      });
    });

    chart.timeScale().fitContent();
  }, [dayCandles, dayTrades, selectedDate]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[12px] font-semibold text-foreground lowercase">
            momentum candle chart
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {symbol} · m15 · 09:30 – 16:00 ny · {dayTrades.length} trade
            {dayTrades.length === 1 ? "" : "s"} on selected day
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">day</span>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="h-8 w-[150px] text-[12px] bg-input border-border">
              <SelectValue placeholder="select day" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {availableDates.map((d) => {
                const tradeCount = trades.filter((t) => t.date === d).length;
                return (
                  <SelectItem key={d} value={d} className="text-[12px]">
                    {d} {tradeCount > 0 && <span className="text-muted-foreground">· {tradeCount}</span>}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-[360px]" />

      <div className="px-4 py-2 border-t border-border flex flex-wrap items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#3b82f6]" />
          <span className="text-muted-foreground">entry</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#22c55e]" />
          <span className="text-muted-foreground">tp 50%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#ef4444]" />
          <span className="text-muted-foreground">sl full</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#f59e0b]" />
          <span className="text-muted-foreground">sl half (midpoint)</span>
        </div>
      </div>
    </div>
  );
};

export default MomentumCandleChart;
