import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preferStoredFor, loadStoredValues } from "@/lib/data-source";
import { analyzeIB } from "@/lib/ib-analysis";
import { analyzeMomentum } from "@/lib/momentum-analysis";
import { analyzeOCC } from "@/lib/occ-analysis";
import { formatOCCResult } from "@/lib/occ-formatter";
import { analyzeGapFill } from "@/lib/gapfill-analysis";
import { analyzeInsideBar } from "@/lib/insidebar-analysis";
import { analyzeOutsideDay } from "@/lib/outsideday-analysis";
import { analyzeLondonIB } from "@/lib/london-ib-analysis";
import { z } from "zod";

const BarSchema = z.object({
  datetime: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
}).passthrough();

const TwelveDataResponseSchema = z.object({
  values: z.array(BarSchema).min(1),
}).passthrough();

export interface ToolCallArgs {
  symbol: string;
  mode: "ib" | "momentum" | "occ" | "gapfill" | "insidebar" | "outsideday" | "london-ib";
  max_days?: number;
  ib_window?: number;
}

const MAX_BATCH_DAYS = 60;
const BATCH_OUTPUTSIZE = 5000;
const BATCH_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchMarketData(ticker: string, totalDays: number) {
  if (preferStoredFor("app")) {
    const stored = await loadStoredValues(ticker.toUpperCase(), "5min", totalDays);
    if (stored.values.length > 0) return stored;
  }
  if (totalDays <= MAX_BATCH_DAYS) {
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
      body: { symbol: ticker, outputsize: String(BATCH_OUTPUTSIZE), key_index: 0 },
    });
    if (error) throw new Error("Failed to fetch market data");
    return data;
  }

  let allValues: any[] = [];
  let endDate: string | null = null;
  let remaining = totalDays;
  let batchIndex = 0;

  while (remaining > 0) {
    const body: Record<string, any> = {
      symbol: ticker,
      outputsize: String(BATCH_OUTPUTSIZE),
      key_index: batchIndex,
    };
    if (endDate) body.end_date = endDate;

    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body });
    if (error) throw new Error("Failed to fetch market data (batch " + (batchIndex + 1) + ")");
    if (data?.status === "error") throw new Error(data.message || "API error");

    const values = data?.values;
    if (!values || !Array.isArray(values) || values.length === 0) break;

    allValues = allValues.concat(values);
    endDate = values[values.length - 1].datetime;
    remaining -= MAX_BATCH_DAYS;
    batchIndex++;

    if (remaining > 0) await sleep(BATCH_DELAY_MS);
  }

  const seen = new Set<string>();
  const deduped = allValues.filter((v) => {
    if (seen.has(v.datetime)) return false;
    seen.add(v.datetime);
    return true;
  });

  return { values: deduped };
}

function formatAnalysisResult(mode: string, result: any): string {
  switch (mode) {
    case "ib": {
      const r = result;
      const hf = r.highFirst;
      const lf = r.lowFirst;
      const hfTotal = hf.breakHigh + hf.breakLow + hf.inside;
      const lfTotal = lf.breakHigh + lf.breakLow + lf.inside;
      return JSON.stringify({
        mode: "ib",
        totalDays: r.totalDays,
        insideDays: r.insideDays,
        ibWindowMinutes: r.ibWindowMinutes,
        highFirst: {
          total: hfTotal,
          breakHighPct: hfTotal > 0 ? Math.round((hf.breakHigh / hfTotal) * 100) : 0,
          breakLowPct: hfTotal > 0 ? Math.round((hf.breakLow / hfTotal) * 100) : 0,
          insidePct: hfTotal > 0 ? Math.round((hf.inside / hfTotal) * 100) : 0,
        },
        lowFirst: {
          total: lfTotal,
          breakHighPct: lfTotal > 0 ? Math.round((lf.breakHigh / lfTotal) * 100) : 0,
          breakLowPct: lfTotal > 0 ? Math.round((lf.breakLow / lfTotal) * 100) : 0,
          insidePct: lfTotal > 0 ? Math.round((lf.inside / lfTotal) * 100) : 0,
        },
        lastDay: r.lastDay ? {
          date: r.lastDay.date,
          ibHigh: r.lastDay.ibHigh,
          ibLow: r.lastDay.ibLow,
          highFirstFormed: r.lastDay.highFirstFormed,
          breakout: r.lastDay.breakout,
        } : null,
      });
    }
    case "momentum": {
      const r = result;
      const tfSummary: Record<string, any> = {};
      for (const [tf, stats] of Object.entries(r.tfStats)) {
        const s = stats as any;
        tfSummary[tf] = {
          total: s.total,
          bullishPct: s.total > 0 ? Math.round((s.bullish / s.total) * 100) : 0,
          bearishPct: s.total > 0 ? Math.round((s.bearish / s.total) * 100) : 0,
          choppyPct: s.total > 0 ? Math.round((s.choppy / s.total) * 100) : 0,
        };
      }
      return JSON.stringify({
        mode: "momentum",
        totalDays: r.totalDays,
        tfStats: tfSummary,
        lastDay: r.lastDay ? {
          date: r.lastDay.date,
          overallBias: r.lastDay.overallBias,
        } : null,
      });
    }
    case "occ": {
      return formatOCCResult(result);
    }
    case "gapfill": {
      const r = result;
      return JSON.stringify({
        mode: "gapfill",
        totalDays: r.totalDays,
        stats: r.stats,
      });
    }
    case "insidebar": {
      const r = result;
      return JSON.stringify({
        mode: "insidebar",
        totalDays: r.totalDays,
        insideBarDays: r.insideBarDays,
        insideBarPct: r.insideBarPct,
        breakoutPct: r.breakoutPct,
        brokeHighPct: r.brokeHighPct,
        brokeLowPct: r.brokeLowPct,
        stayedInsidePct: r.stayedInsidePct,
      });
    }
    case "outsideday": {
      const r = result;
      return JSON.stringify({
        mode: "outsideday",
        totalDays: r.totalDays,
        outsideDays: r.outsideDays,
        outsidePct: r.outsidePct,
        bullishContinuationPct: r.bullishContinuationPct,
        bearishContinuationPct: r.bearishContinuationPct,
      });
    }
    case "london-ib": {
      const r = result;
      const hf = r.highFirst;
      const lf = r.lowFirst;
      const hfTotal = hf.breakHigh + hf.breakLow + hf.inside;
      const lfTotal = lf.breakHigh + lf.breakLow + lf.inside;
      return JSON.stringify({
        mode: "london-ib",
        totalDays: r.totalDays,
        ibWindowMinutes: r.ibWindowMinutes,
        session: "03:00 AM – 11:30 AM ET",
        highFirst: {
          total: hfTotal,
          breakHighPct: hfTotal > 0 ? Math.round((hf.breakHigh / hfTotal) * 100) : 0,
          breakLowPct: hfTotal > 0 ? Math.round((hf.breakLow / hfTotal) * 100) : 0,
          insidePct: hfTotal > 0 ? Math.round((hf.inside / hfTotal) * 100) : 0,
        },
        lowFirst: {
          total: lfTotal,
          breakHighPct: lfTotal > 0 ? Math.round((lf.breakHigh / lfTotal) * 100) : 0,
          breakLowPct: lfTotal > 0 ? Math.round((lf.breakLow / lfTotal) * 100) : 0,
          insidePct: lfTotal > 0 ? Math.round((lf.inside / lfTotal) * 100) : 0,
        },
        breakTypeStats: r.breakTypeStats,
      });
    }
    default:
      return JSON.stringify({ error: "Unknown mode" });
  }
}

export function useAIAnalysis() {
  const executeAnalysis = useCallback(async (args: ToolCallArgs): Promise<string> => {
    const { symbol, mode, max_days = 60, ib_window = 60 } = args;

    try {
      const json = await fetchMarketData(symbol.toUpperCase(), max_days);

      if (json.status === "error") {
        return JSON.stringify({ error: json.message || "API error fetching data for " + symbol });
      }

      const parsed = TwelveDataResponseSchema.safeParse(json);
      if (!parsed.success) {
        return JSON.stringify({ error: "Invalid or empty data returned for " + symbol });
      }

      const values = parsed.data.values as any;
      let result: any;

      switch (mode) {
        case "ib":
          result = analyzeIB(values, ib_window, max_days);
          break;
        case "momentum":
          result = analyzeMomentum(values, ib_window, max_days, 0.50);
          break;
        case "occ":
          result = analyzeOCC(values, max_days, "30m");
          break;
        case "gapfill":
          result = analyzeGapFill(values, max_days);
          break;
        case "insidebar":
          result = analyzeInsideBar(values, max_days);
          break;
        case "outsideday":
          result = analyzeOutsideDay(values, max_days);
          break;
        case "london-ib":
          result = analyzeLondonIB(values, ib_window, max_days);
          break;
        default:
          return JSON.stringify({ error: "Unknown analysis mode: " + mode });
      }

      if (result.totalDays === 0) {
        return JSON.stringify({ error: "Not enough data for " + symbol + " " + mode });
      }

      return formatAnalysisResult(mode, result);
    } catch (err: any) {
      return JSON.stringify({ error: err.message || "Analysis failed for " + symbol });
    }
  }, []);

  return { executeAnalysis };
}
