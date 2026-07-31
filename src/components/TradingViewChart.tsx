import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeMomentumFlags, computeMomentumFlagsByDay } from "@/lib/momentum-candle";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  BaselineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
  showIB?: boolean;
  showMC?: boolean;
  showPB?: boolean;
}

const TradingViewChart = ({ symbol, interval, showIB = false, showMC = false, showPB = false }: TradingViewChartProps) => {

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ibSeriesListRef = useRef<ISeriesApi<"Line">[]>([]);
  const pbSeriesListRef = useRef<ISeriesApi<"Line" | "Baseline">[]>([]);
  const pbMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [ohlc, setOhlc] = useState<{
    o: number; h: number; l: number; c: number; change: number; changePct: number;
  } | null>(null);

  // Init chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#787B86",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.5)" },
        horzLines: { color: "rgba(42, 46, 57, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(224, 227, 235, 0.1)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#2B2B43",
        },
        horzLine: {
          color: "rgba(224, 227, 235, 0.1)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#2B2B43",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(42, 46, 57, 0.5)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(42, 46, 57, 0.5)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#1b5e20",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#1b5e20",
      wickDownColor: "#363A45",
      wickUpColor: "#363A45",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    // Crosshair move → update OHLC header
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setOhlc(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      if (data) {
        const change = data.close - data.open;
        const changePct = (change / data.open) * 100;
        setOhlc({
          o: data.open,
          h: data.high,
          l: data.low,
          c: data.close,
          change,
          changePct,
        });
      }
    });

    // Responsive resize
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      }
    });
    ro.observe(containerRef.current);

    setChartReady(true);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      setChartReady(false);
    };
  }, []);

  // Fetch data when symbol/interval changes AND chart is ready
  useEffect(() => {
    if (!chartReady || !seriesRef.current || !volumeRef.current) return;

    const fetchData = async () => {
      try {
        // Get user session token
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          console.error("No auth session");
          return;
        }

        const baseUrl = import.meta.env.VITE_SUPABASE_URL;

        // Map interval to Polygon multiplier/timespan
        const intervalMap: Record<string, { multiplier: number; timespan: string }> = {
          "5min": { multiplier: 5, timespan: "minute" },
          "15min": { multiplier: 15, timespan: "minute" },
          "30min": { multiplier: 30, timespan: "minute" },
          "1h": { multiplier: 1, timespan: "hour" },
          "1day": { multiplier: 1, timespan: "day" },
        };

        const mapped = intervalMap[interval] || { multiplier: 5, timespan: "minute" };

        // Calculate date range
        const now = new Date();
        const to = now.toISOString().split("T")[0];
        let fromDate: Date;
        if (interval === "1day") {
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 365);
        } else {
          // Intraday (5m/15m/30m/1h): tampilkan ~1 bulan terakhir
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 30);
        }
        const from = fromDate.toISOString().split("T")[0];

        // Use massive-bars edge function (Polygon API)
        const res = await fetch(`${baseUrl}/functions/v1/massive-bars`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            symbol,
            from,
            to,
            multiplier: mapped.multiplier,
            timespan: mapped.timespan,
          }),
        });

        if (!res.ok) throw new Error("Failed to fetch data");

        const json = await res.json();
        if (!json.values || !Array.isArray(json.values)) {
          throw new Error("No data returned");
        }

        // massive-bars already returns sorted ascending ET datetimes
        const sorted = json.values;

        // Parse bars
        const candles: CandlestickData<Time>[] = [];
        const volumes: { time: Time; value: number; color: string }[] = [];

        for (const bar of sorted) {
          const time = (interval === "1day"
            ? bar.datetime.split(" ")[0]
            : Math.floor(new Date(bar.datetime.replace(" ", "T") + "Z").getTime() / 1000)) as Time;

          const o = parseFloat(bar.open);
          const h = parseFloat(bar.high);
          const l = parseFloat(bar.low);
          const c = parseFloat(bar.close);
          const v = bar.volume ? parseFloat(bar.volume) : 0;

          candles.push({ time, open: o, high: h, low: l, close: c });
          volumes.push({
            time,
            value: v,
            color: c >= o ? "rgba(38,166,154,0.3)" : "rgba(239,83,80,0.3)",
          });
        }

        seriesRef.current!.setData(candles);
        volumeRef.current!.setData(volumes);

        // Remove old IB line series
        const chart = chartRef.current!;
        for (const s of ibSeriesListRef.current) {
          try { chart.removeSeries(s); } catch {}
        }
        ibSeriesListRef.current = [];

        // Calculate IB per trading day (intraday only)
        if (showIB && interval !== "1day" && sorted.length > 0) {
          const dayBars: Record<string, typeof sorted> = {};
          for (const bar of sorted) {
            const date = bar.datetime.split(" ")[0];
            if (!dayBars[date]) dayBars[date] = [];
            dayBars[date].push(bar);
          }

          const toTs = (dt: string) =>
            Math.floor(new Date(dt.replace(" ", "T") + "Z").getTime() / 1000) as Time;

          const lineBaseOpts = { priceScaleId: "right", lastValueVisible: false, crosshairMarkerVisible: false, priceLineVisible: false };

          for (const date of Object.keys(dayBars).sort()) {
            const bars = dayBars[date];
            let ibHigh = -Infinity;
            let ibLow = Infinity;
            for (const bar of bars) {
              const time = bar.datetime.split(" ")[1];
              if (time >= "09:30:00" && time < "10:30:00") {
                const h = parseFloat(bar.high);
                const l = parseFloat(bar.low);
                if (h > ibHigh) ibHigh = h;
                if (l < ibLow) ibLow = l;
              }
            }
            if (ibHigh === -Infinity || ibLow === Infinity) continue;
            const ib50 = (ibHigh + ibLow) / 2;

            const sessionBars = bars.filter(b => {
              const t = b.datetime.split(" ")[1];
              return t >= "09:30:00" && t <= "16:00:00";
            });
            if (sessionBars.length < 2) continue;

            const startTime = toTs(sessionBars[0].datetime);
            const endTime = toTs(sessionBars[sessionBars.length - 1].datetime);

            // IB High line for this day
            const highSeries = chart.addSeries(LineSeries, { ...lineBaseOpts, color: "#FFFFFF", lineWidth: 1, lineStyle: 0, title: "" });
            highSeries.setData([{ time: startTime, value: ibHigh }, { time: endTime, value: ibHigh }]);
            ibSeriesListRef.current.push(highSeries);

            // IB Low line for this day
            const lowSeries = chart.addSeries(LineSeries, { ...lineBaseOpts, color: "#FFFFFF", lineWidth: 1, lineStyle: 0, title: "" });
            lowSeries.setData([{ time: startTime, value: ibLow }, { time: endTime, value: ibLow }]);
            ibSeriesListRef.current.push(lowSeries);

            // IB 50 line for this day
            const midSeries = chart.addSeries(LineSeries, { ...lineBaseOpts, color: "#00BFFF", lineWidth: 1, lineStyle: 2, title: "" });
            midSeries.setData([{ time: startTime, value: ib50 }, { time: endTime, value: ib50 }]);
            ibSeriesListRef.current.push(midSeries);
          }
        }

        // Momentum Candle (big body) — body vs SMA(15) of body, like the
        // "Momentum Candle" indicator. Super body (> 1.5x avg) = momentum candle.
        if (showMC && interval !== "1day" && sorted.length > 0) {
          const ohlcSeries = sorted.map((b) => ({
            open: parseFloat(b.open),
            high: parseFloat(b.high),
            low: parseFloat(b.low),
            close: parseFloat(b.close),
          }));
          const flags = computeMomentumFlags(ohlcSeries);

          const toTs = (dt: string) =>
            Math.floor(new Date(dt.replace(" ", "T") + "Z").getTime() / 1000);

          const colorByTs = new Map<number, string>();
          sorted.forEach((bar, i) => {
            const f = flags[i];
            if (!f.direction) return;
            let color: string | null = null;
            if (f.level === "super") {
              color = f.direction === "bullish" ? "rgb(157,255,0)" : "rgb(210,1,252)";
            } else if (f.level === "above") {
              color = f.direction === "bullish" ? "rgb(3,129,108)" : "rgb(243,63,63)";
            }
            if (color) colorByTs.set(toTs(bar.datetime), color);
          });

          const recolored = candles.map((c) => {
            const ts = c.time as number;
            const color = colorByTs.get(ts);
            if (color) return { ...c, color, borderColor: color, wickColor: color };
            return c;
          });
          seriesRef.current!.setData(recolored);
        }


        // Clear previous PB50 overlays
        for (const s of pbSeriesListRef.current) {
          try { chart.removeSeries(s); } catch {}
        }
        pbSeriesListRef.current = [];
        if (pbMarkersRef.current) {
          try { pbMarkersRef.current.setMarkers([]); } catch {}
        }

        // PB50 — 50% pullback strategy markers (15m only, intraday)
        if (showPB && interval === "15min" && sorted.length > 0) {
          const MAX_LOOKAHEAD = 2; // candle 2 & 3
          const dayBars: Record<string, typeof sorted> = {};
          for (const bar of sorted) {
            const t = bar.datetime.split(" ")[1];
            // Match /app: session 09:30–16:00 NY only
            if (t < "09:30:00" || t >= "16:00:00") continue;
            const date = bar.datetime.split(" ")[0];
            if (!dayBars[date]) dayBars[date] = [];
            dayBars[date].push(bar);
          }
          const toTs = (dt: string) =>
            Math.floor(new Date(dt.replace(" ", "T") + "Z").getTime() / 1000) as Time;

          // Momentum flags (body vs SMA15 of body) computed across the continuous series
          const pbDates = Object.keys(dayBars).sort();
          const pbFlagsByDay = computeMomentumFlagsByDay(
            pbDates.map((d) =>
              dayBars[d].map((b) => ({
                open: parseFloat(b.open),
                high: parseFloat(b.high),
                low: parseFloat(b.low),
                close: parseFloat(b.close),
              }))
            )
          );

          const pbMarkers: SeriesMarker<Time>[] = [];
          const lineOpts = { priceScaleId: "right", lastValueVisible: false, crosshairMarkerVisible: false, priceLineVisible: false };

          for (let dIdx = 0; dIdx < pbDates.length; dIdx++) {
            const date = pbDates[dIdx];
            const bars = dayBars[date];
            const dayFlags = pbFlagsByDay[dIdx];
            // Only consider bars within 09:30–13:00 NY as candle 1
            let gateUntil = -1;
            for (let i = 0; i < bars.length - 1; i++) {
              if (i <= gateUntil) continue;
              const b = bars[i];
              const t = b.datetime.split(" ")[1];
              if (t < "09:30:00" || t >= "13:00:00") continue;

              const o = parseFloat(b.open);
              const h = parseFloat(b.high);
              const l = parseFloat(b.low);
              const c = parseFloat(b.close);
              const range = h - l;
              if (range <= 0 || c === o) continue;
              const flag = dayFlags[i];
              if (!flag?.isSuper || !flag.direction) continue;


              const isBull = c > o;
              const entry = (h + l) / 2;
              const stop = isBull ? l : h;
              const target = isBull ? h : l;

              // Check trigger on candle 2 / 3
              let triggered = false;
              let invalidated = false;
              let resolvedIdx = -1;
              const deadline = Math.min(i + MAX_LOOKAHEAD, bars.length - 1);
              for (let j = i + 1; j < bars.length; j++) {
                const nb = bars[j];
                const nh = parseFloat(nb.high);
                const nl = parseFloat(nb.low);
                const no = parseFloat(nb.open);
                const nc = parseFloat(nb.close);
                if (!triggered) {
                  const trig = isBull ? nl <= entry : nh >= entry;
                  if (!trig) {
                    // invalidate if untriggered bar is itself a momentum candle
                    if (dayFlags[j]?.isSuper) {
                      invalidated = true;
                      break;
                    }

                    if (j >= deadline) break;
                    continue;
                  }
                  triggered = true;
                }
                const hitStop = isBull ? nl <= stop : nh >= stop;
                const hitTarget = isBull ? nh >= target : nl <= target;
                if (hitStop || hitTarget) { resolvedIdx = j; break; }
              }
              if (invalidated) continue;
              if (!triggered) continue;
              // Match /app: skip "open" outcomes (triggered but never hit SL/TP)
              if (resolvedIdx < 0) continue;

              const startTs = toTs(b.datetime);
              const endTs = toTs(bars[resolvedIdx].datetime);

              // TradingView-style position tool: shaded risk (red) & reward (green) zones
              const zoneOpts = {
                ...lineOpts,
                lineWidth: 1 as const,
                baseLineVisible: false,
                pointMarkersVisible: false,
                title: "",
              };

              // risk zone: entry -> SL
              const riskSeries = chart.addSeries(BaselineSeries, {
                ...zoneOpts,
                baseValue: { type: "price" as const, price: entry },
                topLineColor: "rgba(239,83,80,0.9)",
                topFillColor1: "rgba(239,83,80,0.28)",
                topFillColor2: "rgba(239,83,80,0.28)",
                bottomLineColor: "rgba(239,83,80,0.9)",
                bottomFillColor1: "rgba(239,83,80,0.28)",
                bottomFillColor2: "rgba(239,83,80,0.28)",
              });
              riskSeries.setData([{ time: startTs, value: stop }, { time: endTs, value: stop }]);
              pbSeriesListRef.current.push(riskSeries);

              // reward zone: entry -> TP
              const rewardSeries = chart.addSeries(BaselineSeries, {
                ...zoneOpts,
                baseValue: { type: "price" as const, price: entry },
                topLineColor: "rgba(38,166,154,0.9)",
                topFillColor1: "rgba(38,166,154,0.25)",
                topFillColor2: "rgba(38,166,154,0.25)",
                bottomLineColor: "rgba(38,166,154,0.9)",
                bottomFillColor1: "rgba(38,166,154,0.25)",
                bottomFillColor2: "rgba(38,166,154,0.25)",
              });
              rewardSeries.setData([{ time: startTs, value: target }, { time: endTs, value: target }]);
              pbSeriesListRef.current.push(rewardSeries);

              // entry line (dashed) across the position box
              const entrySeries = chart.addSeries(LineSeries, { ...lineOpts, color: "#c9d1e1", lineWidth: 1, lineStyle: 2, title: "" });
              entrySeries.setData([{ time: startTs, value: entry }, { time: endTs, value: entry }]);
              pbSeriesListRef.current.push(entrySeries);

              // no text labels — zones only

              gateUntil = resolvedIdx;
            }
          }

          if (pbMarkers.length > 0) {
            pbMarkers.sort((a, b) => (a.time as number) - (b.time as number));
            if (!pbMarkersRef.current) {
              pbMarkersRef.current = createSeriesMarkers(seriesRef.current!, pbMarkers);
            } else {
              pbMarkersRef.current.setMarkers(pbMarkers);
            }
          }
        }

        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          setOhlc({
            o: last.open,
            h: last.high,
            l: last.low,
            c: last.close,
            change: last.close - last.open,
            changePct: ((last.close - last.open) / last.open) * 100,
          });
        }

        chartRef.current?.timeScale().fitContent();
      } catch (err) {
        console.error("Chart data fetch error:", err);
      }
    };

    fetchData();
  }, [symbol, interval, chartReady, showIB, showMC, showPB]);

  const isPositive = ohlc ? ohlc.change >= 0 : true;

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "#131722" }}>
      {/* OHLC Header */}
      <div className="flex items-center gap-4 px-4 py-2 text-[13px] font-mono" style={{ color: "#D1D4DC" }}>
        <span className="font-semibold text-white">{symbol}</span>
        <span className="text-[#787B86]">·</span>
        <span className="text-[#787B86]">{interval}</span>
        {ohlc && (
          <>
            <span>
              O <span className={isPositive ? "text-[#26a69a]" : "text-[#ef5350]"}>{ohlc.o.toFixed(2)}</span>
            </span>
            <span>
              H <span className={isPositive ? "text-[#26a69a]" : "text-[#ef5350]"}>{ohlc.h.toFixed(2)}</span>
            </span>
            <span>
              L <span className={isPositive ? "text-[#26a69a]" : "text-[#ef5350]"}>{ohlc.l.toFixed(2)}</span>
            </span>
            <span>
              C <span className={isPositive ? "text-[#26a69a]" : "text-[#ef5350]"}>{ohlc.c.toFixed(2)}</span>
            </span>
            <span className={isPositive ? "text-[#26a69a]" : "text-[#ef5350]"}>
              {isPositive ? "+" : ""}{ohlc.change.toFixed(2)} ({isPositive ? "+" : ""}{ohlc.changePct.toFixed(2)}%)
            </span>
          </>
        )}
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="flex-1 w-full min-h-0" />
    </div>
  );
};

export default TradingViewChart;
