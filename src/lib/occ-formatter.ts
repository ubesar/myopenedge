import type { OCCResult, OCCDirectionResult, OCCDayResult } from "./occ-analysis";

export interface OCCFormattedPayload {
  mode: "occ";
  totalDays: number;
  candleSize: string;
  greenOpeningCandle: {
    total: number;
    continuesGreenPct: number;
    reversesRedPct: number;
  };
  redOpeningCandle: {
    total: number;
    continuesRedPct: number;
    reversesGreenPct: number;
  };
  lastDay: {
    date: string;
    openingCandleGreen: boolean;
    dayEndGreen: boolean;
  } | null;
}

export interface OCCFormatError {
  error: string;
  missingFields?: string[];
}

function isDirection(v: unknown): v is OCCDirectionResult {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.total === "number" &&
    typeof o.greenDayPct === "number" &&
    typeof o.redDayPct === "number"
  );
}

/**
 * Validate an analyzeOCC result. Returns null when valid, or an
 * OCCFormatError describing what's missing. Used to guard against
 * regressions where formatter accesses removed legacy fields.
 */
export function validateOCCResult(result: unknown): OCCFormatError | null {
  if (!result || typeof result !== "object") {
    return { error: "OCC result is missing or not an object" };
  }
  const r = result as Record<string, unknown>;
  const missing: string[] = [];
  if (typeof r.totalDays !== "number") missing.push("totalDays");
  if (!isDirection(r.greenCandle)) missing.push("greenCandle");
  if (!isDirection(r.redCandle)) missing.push("redCandle");
  if (!Array.isArray(r.allDays)) missing.push("allDays");
  if (missing.length > 0) {
    return {
      error: `OCC result is malformed (missing/invalid: ${missing.join(", ")})`,
      missingFields: missing,
    };
  }
  return null;
}

export function buildOCCPayload(result: OCCResult): OCCFormattedPayload {
  const lastDay: OCCDayResult | undefined = result.allDays[result.allDays.length - 1];
  return {
    mode: "occ",
    totalDays: result.totalDays,
    candleSize: result.candleSize,
    greenOpeningCandle: {
      total: result.greenCandle.total,
      continuesGreenPct: Math.round(result.greenCandle.greenDayPct),
      reversesRedPct: Math.round(result.greenCandle.redDayPct),
    },
    redOpeningCandle: {
      total: result.redCandle.total,
      continuesRedPct: Math.round(result.redCandle.redDayPct),
      reversesGreenPct: Math.round(result.redCandle.greenDayPct),
    },
    lastDay: lastDay
      ? {
          date: lastDay.date,
          openingCandleGreen: lastDay.openingCandleGreen,
          dayEndGreen: lastDay.dayEndGreen,
        }
      : null,
  };
}

/**
 * Safe formatter: validates first, returns either the JSON payload
 * or a JSON error string. Never throws.
 */
export function formatOCCResult(result: unknown): string {
  const err = validateOCCResult(result);
  if (err) return JSON.stringify(err);
  return JSON.stringify(buildOCCPayload(result as OCCResult));
}
