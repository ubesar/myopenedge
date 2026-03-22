export type GlobexIBWindow = 30 | 60 | 120 | 180;

export type GlobexBreakDirection = "BREAK_HIGH" | "BREAK_LOW" | "BOTH" | "INSIDE";

export type RTHOpenPosition = "ABOVE" | "BELOW" | "INSIDE_UPPER" | "INSIDE_LOWER" | "MID";

export type RTHOutcome = "BREAK_HIGH" | "BREAK_LOW" | "INSIDE";

export type RTHFirstTest = "HIGH" | "LOW" | "NONE";

export interface GlobexIBResult {
  rthDate: string;
  globexHigh: number;
  globexLow: number;
  globexRange: number;
  globexIBHigh: number;
  globexIBLow: number;
  globexIBRange: number;
  globexBreakDirection: GlobexBreakDirection;
  rthOpen: number;
  rthOpenPosition: RTHOpenPosition;
  rthOutcome: RTHOutcome;
  rthFirstTest: RTHFirstTest;
  rthBreakoutBar: string | null;
}

export interface ConditionalBreakdown {
  label: string;
  total: number;
  breakHigh: number;
  breakLow: number;
  inside: number;
  breakHighPct: number;
  breakLowPct: number;
  insidePct: number;
}

export interface GlobexIBStats {
  totalDays: number;
  breakHigh: number;
  breakLow: number;
  inside: number;
  breakHighPct: number;
  breakLowPct: number;
  insidePct: number;
  byRTHOpenPosition: ConditionalBreakdown[];
  byGlobexBreakDirection: ConditionalBreakdown[];
  byFirstTest: ConditionalBreakdown[];
}

export type DataProvider = "twelvedata" | "massive";

export interface NormalizedBar {
  timestamp: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  datetime: string; // original datetime string
}
