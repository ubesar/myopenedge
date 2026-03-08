import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
  showIB?: boolean;
}

const TradingViewChart = ({ symbol, interval, showIB = false }: TradingViewChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ibHighSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ibLowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ib50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
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
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
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

        // Use TwelveData proxy edge function
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const outputSize = interval === "1day" ? 365 : 390;
        const res = await fetch(
          `${baseUrl}/functions/v1/twelvedata-proxy?symbol=${symbol}&interval=${interval}&outputsize=${outputSize}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!res.ok) throw new Error("Failed to fetch data");

        const json = await res.json();
        if (!json.values || !Array.isArray(json.values)) {
          throw new Error("No data returned");
        }

        // Parse and sort ascending
        const candles: CandlestickData<Time>[] = [];
        const volumes: { time: Time; value: number; color: string }[] = [];

        const sorted = [...json.values].reverse();

        for (const bar of sorted) {
          // lightweight-charts needs unix timestamp for intraday
          const time = (interval === "1day"
            ? bar.datetime
            : Math.floor(new Date(bar.datetime.replace(" ", "T") + "-04:00").getTime() / 1000)) as Time;

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

        // Remove old IB price lines
        const series = seriesRef.current!;
        try { series.removePriceLine(ibHighLineRef.current!); } catch {}
        try { series.removePriceLine(ibLowLineRef.current!); } catch {}
        try { series.removePriceLine(ib50LineRef.current!); } catch {}
        ibHighLineRef.current = null;
        ibLowLineRef.current = null;
        ib50LineRef.current = null;

        // Calculate IB for the most recent trading day (intraday only)
        if (showIB && interval !== "1day" && sorted.length > 0) {
          // Find the latest trading date
          const latestDatetime = sorted[sorted.length - 1].datetime; // e.g. "2026-03-06 15:55:00"
          const latestDate = latestDatetime.split(" ")[0]; // "2026-03-06"

          // Filter bars for latest date between 09:30 and 10:30
          let ibHigh = -Infinity;
          let ibLow = Infinity;
          for (const bar of sorted) {
            const [date, time] = bar.datetime.split(" ");
            if (date !== latestDate) continue;
            if (time >= "09:30:00" && time < "10:30:00") {
              const h = parseFloat(bar.high);
              const l = parseFloat(bar.low);
              if (h > ibHigh) ibHigh = h;
              if (l < ibLow) ibLow = l;
            }
          }

          if (ibHigh !== -Infinity && ibLow !== Infinity) {
            const ib50 = (ibHigh + ibLow) / 2;

            ibHighLineRef.current = series.createPriceLine({
              price: ibHigh,
              color: "#FFFFFF",
              lineWidth: 1,
              lineStyle: 0, // Solid
              axisLabelVisible: true,
              title: "IB High",
            });

            ibLowLineRef.current = series.createPriceLine({
              price: ibLow,
              color: "#FFFFFF",
              lineWidth: 1,
              lineStyle: 0,
              axisLabelVisible: true,
              title: "IB Low",
            });

            ib50LineRef.current = series.createPriceLine({
              price: ib50,
              color: "#00BFFF",
              lineWidth: 1,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: "IB 50",
            });
          }
        }

        // Set last bar as OHLC
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
  }, [symbol, interval, chartReady, showIB]);

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
