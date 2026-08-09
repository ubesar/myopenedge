import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Target, Play, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { analyzePullback50, type Pullback50Trade } from "@/lib/pullback50-analysis";
import { analyzeIB2575, type IB2575Trade } from "@/lib/ib2575-analysis";
import { analyzeORBPullback, type ORBPullbackTrade, type ORBPullbackResult } from "@/lib/orb-pullback-analysis";
import TradeChartDialog, { type TradeForChart } from "@/components/TradeChartDialog";
import { parseCsvBars, type CsvBar } from "@/lib/csv-bars";
import BacktestCalendar from "@/components/BacktestCalendar";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StrategyKey = "pb50" | "ib2575" | "orbpb";

interface BTTrade {
  date: string;
  time?: string;
  direction: "bullish" | "bearish";
  entry: number;
  stop: number;
  target: number;
  outcome: "win" | "loss";
  rMultiple: number;   // +TP/SL or -1
  pnl: number;         // dollars (fixed $100 risk)
  qty: number;
  ib?: { high: number; low: number; q25: number; q50: number; q75: number; windowMinutes: number };
}



interface BTResult {
  strategy: StrategyKey;
  symbol: string;
  totalDays: number;
  trades: BTTrade[];
  bars: any[];
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  expectancy: number;
  bestDay: number;
  worstDay: number;
  orb?: ORBPullbackResult;
}


const RISK_USD = 100;
const MAX_BATCH_DAYS = 60;
const BATCH_OUTPUTSIZE = 5000;
const BATCH_DELAY_MS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchMarketData(ticker: string, totalDays: number) {
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
    if (error) throw new Error("Failed to fetch batch " + (batchIndex + 1));
    if (data?.status === "error") throw new Error(data.message || "API error");
    const values = data?.values;
    if (!values?.length) break;
    allValues = allValues.concat(values);
    endDate = values[values.length - 1].datetime;
    remaining -= MAX_BATCH_DAYS;
    batchIndex++;
    if (remaining > 0) await sleep(BATCH_DELAY_MS);
  }
  const seen = new Set<string>();
  return { values: allValues.filter((v) => (seen.has(v.datetime) ? false : (seen.add(v.datetime), true))) };
}

/** Pre-market capable source (Massive API) — used when the scan starts before 09:30 NY. */
async function fetchMassiveData(ticker: string, totalDays: number) {
  const MASSIVE_BATCH_DAYS = 90;
  const now = new Date();
  const calendarDaysNeeded = Math.ceil(totalDays * 1.5) + 7;
  let currentFrom = new Date(now);
  currentFrom.setDate(currentFrom.getDate() - calendarDaysNeeded);
  const totalBatches = Math.ceil(calendarDaysNeeded / MASSIVE_BATCH_DAYS);

  let allValues: any[] = [];
  for (let i = 0; i < totalBatches; i++) {
    const batchEnd = new Date(currentFrom);
    batchEnd.setDate(batchEnd.getDate() + MASSIVE_BATCH_DAYS);
    if (batchEnd > now) batchEnd.setTime(now.getTime());
    try {
      const { data, error } = await supabase.functions.invoke("massive-bars", {
        body: {
          symbol: ticker,
          from: currentFrom.toISOString().split("T")[0],
          to: batchEnd.toISOString().split("T")[0],
          multiplier: 5,
          timespan: "minute",
        },
      });
      if (!error && data?.values) allValues = allValues.concat(data.values);
    } catch (e) {
      console.error(`massive batch ${i + 1} failed`, e);
    }
    currentFrom = new Date(batchEnd);
    currentFrom.setDate(currentFrom.getDate() + 1);
    if (i < totalBatches - 1) await sleep(2000);
  }
  const seen = new Set<string>();
  return { values: allValues.filter((v) => (seen.has(v.datetime) ? false : (seen.add(v.datetime), true))) };
}

function toBTTradesPB50(trades: Pullback50Trade[]): BTTrade[] {
  const out: BTTrade[] = [];
  for (const t of trades) {
    if (t.outcome !== "win" && t.outcome !== "loss") continue;
    const slDist = Math.abs(t.entry - t.stop);
    const tpDist = Math.abs(t.target - t.entry);
    const qty = slDist > 0 ? RISK_USD / slDist : 0;
    const rMultiple = t.outcome === "win" ? tpDist / slDist : -1;
    out.push({
      date: t.date,
      time: t.signalTime,
      direction: t.direction,
      entry: t.entry,
      stop: t.stop,
      target: t.target,
      outcome: t.outcome,
      rMultiple,
      pnl: rMultiple * RISK_USD,
      qty,
    });
  }
  return out;
}

function toBTTradesIB2575(trades: IB2575Trade[], ibWindow: number): BTTrade[] {
  return trades
    .filter((t) => t.outcome === "win" || t.outcome === "loss")
    .map((t) => {
      const slDist = Math.abs(t.entry - t.stop);
      const tpDist = Math.abs(t.target - t.entry);
      const qty = slDist > 0 ? RISK_USD / slDist : 0;
      const rMultiple = t.outcome === "win" ? tpDist / slDist : -1;
      const pnl = rMultiple * RISK_USD;
      return {
        date: t.date,
        time: t.entryTime ?? t.confirmTime ?? undefined,
        direction: t.direction,
        entry: t.entry,
        stop: t.stop,
        target: t.target,
        outcome: t.outcome as "win" | "loss",
        rMultiple,
        pnl,
        qty,
        ib: { high: t.ibHigh, low: t.ibLow, q25: t.ib25, q50: t.ib50, q75: t.ib75, windowMinutes: ibWindow },
      };
    });
}
function toBTTradesORB(trades: ORBPullbackTrade[]): BTTrade[] {
  return trades
    .filter((t) => t.status === "win" || t.status === "loss")
    .map((t) => {
      const slDist = Math.abs(t.entry - t.stop);
      const rMultiple = t.status === "win" ? t.realizedRR : -1;
      return {
        date: t.date,
        time: t.triggerTime ?? t.signalTime,
        direction: t.direction,
        entry: t.entry,
        stop: t.stop,
        target: t.target,
        outcome: t.status as "win" | "loss",
        rMultiple,
        pnl: rMultiple * RISK_USD,
        qty: slDist > 0 ? RISK_USD / slDist : 0,
      };
    });
}



function computeMetrics(trades: BTTrade[]): Omit<BTResult, "strategy" | "symbol" | "totalDays" | "trades" | "bars"> {
  const wins = trades.filter((t) => t.outcome === "win");
  const losses = trades.filter((t) => t.outcome === "loss");
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const expectancy = trades.length ? totalPnl / trades.length : 0;

  // drawdown on equity curve
  let peak = 0;
  let equity = 0;
  let maxDD = 0;
  for (const t of trades) {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  const dayMap = new Map<string, number>();
  for (const t of trades) dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + t.pnl);
  const dailyPnls = Array.from(dayMap.values());
  const bestDay = dailyPnls.length ? Math.max(...dailyPnls) : 0;
  const worstDay = dailyPnls.length ? Math.min(...dailyPnls) : 0;

  return {
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    avgWin,
    avgLoss,
    profitFactor,
    maxDrawdown: maxDD,
    expectancy,
    bestDay,
    worstDay,
  };
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Backtester = () => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [symbol, setSymbol] = useState("QQQ");
  const [strategy, setStrategy] = useState<StrategyKey>("pb50");
  const [maxDays, setMaxDays] = useState("120");
  const [ibWindow, setIbWindow] = useState("60");
  const [sessionStart, setSessionStart] = useState("570"); // 09:30 ny open
  const [csvScanStart, setCsvScanStart] = useState("06:00");
  const [csvScanEnd, setCsvScanEnd] = useState("24:00");
  const [csvTpDeadline, setCsvTpDeadline] = useState("04:00");
  const [dataSource, setDataSource] = useState<"api" | "csv">("api");
  const [csvBars, setCsvBars] = useState<CsvBar[] | null>(null); // m15 — momentum scan
  const [csvName, setCsvName] = useState("");
  const [csvM5Bars, setCsvM5Bars] = useState<CsvBar[] | null>(null); // m5 — entry/tp/sl
  const [csvM5Name, setCsvM5Name] = useState("");
  const [csvOffset, setCsvOffset] = useState("0");
  const [pbThreshold, setPbThreshold] = useState("0.5");
  const [tpMult, setTpMult] = useState("0.5");
  const [dynamicSl, setDynamicSl] = useState(true);
  const [sessionEnd, setSessionEnd] = useState("780"); // 13:00 ny


  const toMin = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const csvScanStartMin = Math.min(Math.max(toMin(csvScanStart), 6 * 60), 24 * 60);
  const csvScanEndMin = Math.min(Math.max(toMin(csvScanEnd), csvScanStartMin + 15), 24 * 60);
  const csvCloseMin = 24 * 60 + toMin(csvTpDeadline);


  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BTResult | null>(null);
  const [chartTrade, setChartTrade] = useState<TradeForChart | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const handleCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      const bars = parseCsvBars(text, parseFloat(csvOffset) || 0);
      setCsvM5Bars(bars);
      setCsvM5Name(file.name);
      setCsvBars(bars);
      setCsvName(file.name);
      const guess = file.name.replace(/\.csv$/i, "").split(/[_\-\s]/).find((p) => /^[A-Za-z]{1,6}$/.test(p) && p.toLowerCase() !== "export");
      if (guess) setSymbol(guess.toUpperCase());
      toast.success(`${bars.length} bars m5 loaded from ${file.name}`);
    } catch (e: any) {
      setCsvBars(null);
      setCsvName("");
      setCsvM5Bars(null);
      setCsvM5Name("");
      toast.error(e.message || "failed to parse csv");
    }
  };



  const runBacktest = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const days = parseInt(maxDays);
      let values: any[];
      if (dataSource === "csv") {
        if (!csvBars?.length) throw new Error("import a csv file first");
        values = csvBars;
      } else {
        const usePreMarket = strategy !== "ib2575" && parseInt(sessionStart) < 9 * 60 + 30;
        const json = usePreMarket
          ? await fetchMassiveData(symbol.trim().toUpperCase(), days)
          : await fetchMarketData(symbol.trim().toUpperCase(), days);
        values = json?.values;
      }
      if (!values?.length) throw new Error("no data returned");


      let trades: BTTrade[] = [];
      let totalDays = 0;
      let orb: ORBPullbackResult | undefined;

      if (strategy === "pb50") {
        const isCsv = dataSource === "csv";
        const r = analyzePullback50(
          values,
          days,
          [1, 2, 3, 4, 5],
          isCsv ? csvScanEndMin : 13 * 60,
          isCsv ? csvScanStartMin : parseInt(sessionStart),
          isCsv ? (csvM5Bars ?? undefined) : undefined, // m5 → resolusi entry/tp/sl
          isCsv ? csvCloseMin : undefined,
        );
        trades = toBTTradesPB50(r.trades);
        totalDays = r.totalDays;

      } else if (strategy === "orbpb") {
        const isCsv = dataSource === "csv";
        const r = analyzeORBPullback(values, {
          maxDays: days,
          weekdays: [1, 2, 3, 4, 5],
          sessionStartMinutes: isCsv ? csvScanStartMin : parseInt(sessionStart),
          sessionEndMinutes: isCsv ? csvScanEndMin : parseInt(sessionEnd),
          sessionCloseMinutes: isCsv ? csvCloseMin : undefined,
          pullbackThreshold: parseFloat(pbThreshold),
          tpMultiplier: parseFloat(tpMult),
          dynamicSl,
          intraBars: isCsv ? (csvM5Bars ?? undefined) : undefined,
        });
        trades = toBTTradesORB(r.trades);
        totalDays = r.totalDays;
        orb = r;

      } else {
        const r = analyzeIB2575(values, parseInt(ibWindow), days, [1, 2, 3, 4, 5]);
        trades = toBTTradesIB2575(r.trades, parseInt(ibWindow));
        totalDays = r.totalDays;
      }

      if (trades.length === 0) {
        toast.error("no valid trades found in the selected range");
      }

      const metrics = computeMetrics(trades);
      setResult({
        strategy,
        symbol: symbol.trim().toUpperCase(),
        totalDays,
        trades,
        bars: dataSource === "csv" && csvM5Bars?.length ? csvM5Bars : values,
        ...metrics,
        orb,
      });

      toast.success(`backtest complete: ${trades.length} trades`);
    } catch (e: any) {
      toast.error(e.message || "backtest failed");
    } finally {
      setLoading(false);
    }
  };

  const equityCurve = useMemo(() => {
    if (!result) return [];
    let eq = 0;
    return result.trades.map((t, i) => {
      eq += t.pnl;
      return { i: i + 1, date: t.date, equity: Math.round(eq * 100) / 100 };
    });
  }, [result]);

  const pnlDistribution = useMemo(() => {
    if (!result) return [];
    const buckets = [-300, -200, -100, 0, 100, 200, 300, 400];
    const labels = ["<-200", "-200 to -100", "-100 to 0", "0 to 100", "100 to 200", "200 to 300", "300 to 400", ">400"];
    const counts = new Array(labels.length).fill(0);
    for (const t of result.trades) {
      let idx = 0;
      if (t.pnl < -200) idx = 0;
      else if (t.pnl < -100) idx = 1;
      else if (t.pnl < 0) idx = 2;
      else if (t.pnl < 100) idx = 3;
      else if (t.pnl < 200) idx = 4;
      else if (t.pnl < 300) idx = 5;
      else if (t.pnl < 400) idx = 6;
      else idx = 7;
      counts[idx]++;
    }
    return labels.map((label, i) => ({ label, count: counts[i] }));
  }, [result]);

  const monthlyPnl = useMemo(() => {
    if (!result) return [];
    const m = new Map<string, number>();
    for (const t of result.trades) {
      const key = t.date.slice(0, 7);
      m.set(key, (m.get(key) ?? 0) + t.pnl);
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));
  }, [result]);

  const weekdayPnl = useMemo(() => {
    if (!result) return [];
    const m = new Map<number, { pnl: number; count: number }>();
    for (const t of result.trades) {
      const wd = new Date(t.date + "T12:00:00").getDay();
      const cur = m.get(wd) ?? { pnl: 0, count: 0 };
      cur.pnl += t.pnl;
      cur.count++;
      m.set(wd, cur);
    }
    return [1, 2, 3, 4, 5].map((wd) => {
      const cur = m.get(wd) ?? { pnl: 0, count: 0 };
      return { day: WEEKDAY_NAMES[wd], pnl: Math.round(cur.pnl * 100) / 100, count: cur.count };
    });
  }, [result]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppNavSidebar
        collapsed={isMobile ? !mobileOpen : collapsed}
        onToggle={() => (isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed))}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && (
          <MobileHeader onMenuToggle={() => setMobileOpen(!mobileOpen)} title="backtester" />
        )}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 max-w-[1400px] w-full mx-auto">
          <div>
            <h1 className="text-2xl font-bold lowercase">backtester</h1>
            <p className="text-sm text-muted-foreground lowercase">
              fixed $100 risk per trade · analytics dashboard
            </p>
          </div>

          {/* Controls */}
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">data source</Label>
                <Select value={dataSource} onValueChange={(v) => setDataSource(v as "api" | "csv")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">api key (live data)</SelectItem>
                    <SelectItem value="csv">import csv (ohlc file)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">strategy</Label>
                <Select value={strategy} onValueChange={(v) => setStrategy(v as StrategyKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pb50">50% pullback strategy</SelectItem>
                    <SelectItem value="orbpb">orb m15 pullback (buy stop + dynamic sl)</SelectItem>
                    <SelectItem value="ib2575">ib momentum limit (ib25/75)</SelectItem>

                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">ticker</Label>
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs lowercase">trading days</Label>
                <Select value={maxDays} onValueChange={setMaxDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">1 month</SelectItem>
                    <SelectItem value="60">3 months</SelectItem>
                    <SelectItem value="120">6 months</SelectItem>
                    <SelectItem value="240">12 months</SelectItem>
                    <SelectItem value="480">24 months</SelectItem>
                    {dataSource === "csv" && <SelectItem value="0">all data in csv</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {strategy === "ib2575" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">ib window (min)</Label>
                  <Select value={ibWindow} onValueChange={setIbWindow}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="60">60</SelectItem>
                      <SelectItem value="90">90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : dataSource === "csv" ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs lowercase">scan start (06:00 – 24:00)</Label>
                    <Input
                      type="time"
                      step={900}
                      min="06:00"
                      max="24:00"
                      value={csvScanStart}
                      onChange={(e) => setCsvScanStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs lowercase">scan end (max 24:00)</Label>
                    <Input
                      type="time"
                      step={900}
                      value={csvScanEnd === "24:00" ? "23:59" : csvScanEnd}
                      onChange={(e) => setCsvScanEnd(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs lowercase">batas tp/sl (pagi berikutnya)</Label>
                    <Input
                      type="time"
                      step={900}
                      value={csvTpDeadline}
                      onChange={(e) => setCsvTpDeadline(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground lowercase">posisi ditutup di {csvTpDeadline} hari berikutnya</p>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">scan session start (ny)</Label>
                  <Select value={sessionStart} onValueChange={setSessionStart}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="570">09:30 (ny open)</SelectItem>
                      <SelectItem value="240">04:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

            </div>

            {strategy === "orbpb" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-t border-border pt-3">
                {dataSource !== "csv" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs lowercase">scan session end (ny)</Label>
                    <Select value={sessionEnd} onValueChange={setSessionEnd}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="600">10:00</SelectItem>
                        <SelectItem value="660">11:00</SelectItem>
                        <SelectItem value="720">12:00</SelectItem>
                        <SelectItem value="780">13:00</SelectItem>
                        <SelectItem value="840">14:00</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">pullback threshold (max retrace candle 1)</Label>
                  <Select value={pbThreshold} onValueChange={setPbThreshold}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.3">30%</SelectItem>
                      <SelectItem value="0.4">40%</SelectItem>
                      <SelectItem value="0.5">50% (default)</SelectItem>
                      <SelectItem value="0.618">61.8%</SelectItem>
                      <SelectItem value="0.75">75%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">tp (× extension candle 1)</Label>
                  <Select value={tpMult} onValueChange={setTpMult}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">0.25×</SelectItem>
                      <SelectItem value="0.5">0.5× (default)</SelectItem>
                      <SelectItem value="0.75">0.75×</SelectItem>
                      <SelectItem value="1">1.0×</SelectItem>
                      <SelectItem value="1.5">1.5×</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">dynamic sl (low candle 2)</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={dynamicSl} onCheckedChange={setDynamicSl} />
                    <span className="text-xs text-muted-foreground lowercase">
                      {dynamicSl ? "sl mengikuti extreme pullback" : "sl di ujung candle 1"}
                    </span>
                  </div>
                </div>
                <p className="md:col-span-4 text-[11px] text-muted-foreground lowercase">
                  candle 1 = momentum m15 · candle 2 pullback ke body candle 1 (batal jika retrace &gt; {(parseFloat(pbThreshold) * 100).toFixed(0)}%) · entry buy/sell stop di high/low candle 1 · tp {tpMult}× range candle 1 · risk ${RISK_USD}/trade
                </p>
              </div>
            )}


            {dataSource === "csv" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">csv m5 (scan m15 + entry / tp / sl)</Label>
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCsvFile(f);
                    }}
                    className="text-xs file:text-xs file:mr-3 file:border-0 file:bg-secondary file:text-secondary-foreground file:rounded file:px-2 file:py-1"
                  />
                  <p className="text-[11px] text-muted-foreground lowercase">
                    {csvM5Bars?.length
                      ? `${csvM5Name} · ${csvM5Bars.length} bars m5 · ${csvM5Bars[0].datetime.slice(0, 10)} → ${csvM5Bars[csvM5Bars.length - 1].datetime.slice(0, 10)}`
                      : "format: time,open,high,low,close,volume (ninjatrader export) · m15 dibentuk otomatis pada kelipatan 15 menit"}
                  </p>
                </div>


                <div className="space-y-1.5">
                  <Label className="text-xs lowercase">timezone data csv</Label>
                  <Select value={csvOffset} onValueChange={setCsvOffset}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">wita (waktu asli — tanpa shift)</SelectItem>
                      {[-13, -12, -11, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].map((h) => (
                        <SelectItem key={h} value={String(h)}>shift {h > 0 ? `+${h}` : h} jam</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground lowercase">
                    jam pada csv dianggap wita · re-import file setelah mengubah
                  </p>
                </div>
              </div>
            )}


            <Button onClick={runBacktest} disabled={loading || (dataSource === "csv" && !csvBars?.length)} className="w-full md:w-auto">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />running…</>
              ) : (
                <><Play className="mr-2 h-4 w-4" />run backtest</>
              )}
            </Button>
          </Card>

          {result && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatCard label="total pnl" value={`$${result.totalPnl.toFixed(0)}`} accent={result.totalPnl >= 0 ? "pos" : "neg"} icon={<DollarSign className="h-4 w-4" />} />
                <StatCard label="trades" value={String(result.trades.length)} icon={<Target className="h-4 w-4" />} />
                <StatCard label="win rate" value={`${result.winRate.toFixed(1)}%`} accent={result.winRate >= 50 ? "pos" : "neg"} />
                <StatCard label="profit factor" value={isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"} accent={result.profitFactor >= 1 ? "pos" : "neg"} />
                <StatCard label="expectancy" value={`$${result.expectancy.toFixed(2)}`} accent={result.expectancy >= 0 ? "pos" : "neg"} />
                <StatCard label="max drawdown" value={`-$${result.maxDrawdown.toFixed(0)}`} accent="neg" />
                <StatCard label="wins" value={String(result.wins)} accent="pos" icon={<TrendingUp className="h-4 w-4" />} />
                <StatCard label="losses" value={String(result.losses)} accent="neg" icon={<TrendingDown className="h-4 w-4" />} />
                <StatCard label="avg win" value={`$${result.avgWin.toFixed(0)}`} accent="pos" />
                <StatCard label="avg loss" value={`-$${result.avgLoss.toFixed(0)}`} accent="neg" />
                <StatCard label="best day" value={`$${result.bestDay.toFixed(0)}`} accent="pos" />
                <StatCard label="worst day" value={`$${result.worstDay.toFixed(0)}`} accent="neg" />
                {result.orb && (
                  <>
                    <StatCard label="avg rrr" value={`1:${result.orb.avgRR.toFixed(2)}`} />
                    <StatCard label="setups" value={String(result.orb.setups)} />
                    <StatCard label="invalidated" value={String(result.orb.invalidated)} accent="neg" />
                    <StatCard label="no trigger" value={String(result.orb.noTrigger)} />
                  </>
                )}
              </div>

              {result.orb && (
                <Card className="p-4">
                  <h2 className="text-sm font-semibold mb-3 lowercase">setup distribution</h2>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { label: "triggered win", count: result.orb.wins },
                          { label: "triggered loss", count: result.orb.losses },
                          { label: `invalidated (>${(result.orb.pullbackThreshold * 100).toFixed(0)}%)`, count: result.orb.invalidated },
                          { label: "no trigger", count: result.orb.noTrigger },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground lowercase">
                    trigger rate {result.orb.setups ? ((result.orb.triggered / result.orb.setups) * 100).toFixed(0) : 0}% · long {result.orb.bullish.winRate.toFixed(0)}% wr ({result.orb.bullish.total}) · short {result.orb.bearish.winRate.toFixed(0)}% wr ({result.orb.bearish.total})
                  </p>
                </Card>
              )}


              {/* Equity Curve */}
              <Card className="p-4">
                <h2 className="text-sm font-semibold mb-3 lowercase">equity curve</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="i" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v: any) => [`$${v}`, "equity"]}
                        labelFormatter={(l) => `trade #${l}`}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* PnL Distribution */}
                <Card className="p-4">
                  <h2 className="text-sm font-semibold mb-3 lowercase">pnl distribution</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pnlDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-25} textAnchor="end" height={60} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Weekday */}
                <Card className="p-4">
                  <h2 className="text-sm font-semibold mb-3 lowercase">pnl by weekday</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weekdayPnl}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: any) => [`$${v}`, "pnl"]} />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                        <Bar dataKey="pnl" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Monthly */}
              <Card className="p-4">
                <h2 className="text-sm font-semibold mb-3 lowercase">monthly pnl</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyPnl}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: any) => [`$${v}`, "pnl"]} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                      <Bar dataKey="pnl" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Trade Log — calendar view */}
              <Card className="p-4">
                <BacktestCalendar
                  trades={result.trades.map((t) => ({ date: t.date, pnl: t.pnl }))}
                  selected={selectedDay}
                  onDayClick={(d) => setSelectedDay((prev) => (prev === d ? null : d))}
                />
              </Card>

              <Dialog open={!!selectedDay} onOpenChange={(v) => !v && setSelectedDay(null)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-sm lowercase">trade log · {selectedDay}</DialogTitle>
                  </DialogHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">date</th>
                        <th className="text-left py-2 px-2">time</th>
                        <th className="text-left py-2 px-2">side</th>
                        <th className="text-right py-2 px-2">entry</th>
                        <th className="text-right py-2 px-2">sl</th>
                        <th className="text-right py-2 px-2">tp</th>
                        <th className="text-right py-2 px-2">qty</th>
                        <th className="text-right py-2 px-2">r</th>
                        <th className="text-right py-2 px-2">pnl</th>
                        <th className="text-left py-2 px-2">outcome</th>
                        <th className="text-center py-2 px-2">chart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...result.trades]
                        .map((t, i) => ({ t, seq: i + 1 }))
                        .filter(({ t }) => !selectedDay || t.date === selectedDay)
                        .sort((a, b) => {
                          const d = b.t.date.localeCompare(a.t.date);
                          if (d !== 0) return d;
                          return (b.t.time ?? "").localeCompare(a.t.time ?? "");
                        })
                        .map(({ t, seq }) => (

                        <tr key={seq} className="border-b border-border/40">
                          <td className="py-1.5 px-2 text-muted-foreground">{seq}</td>
                          <td className="py-1.5 px-2">{t.date}</td>
                          <td className="py-1.5 px-2">{t.time ?? "10:25"}</td>
                          <td className={`py-1.5 px-2 font-medium ${t.direction === "bullish" ? "text-emerald-500" : "text-red-500"}`}>
                            {t.direction === "bullish" ? "long" : "short"}
                          </td>
                          <td className="py-1.5 px-2 text-right">{t.entry.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right">{t.stop.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right">{t.target.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right">{t.qty.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right">{t.rMultiple.toFixed(2)}</td>
                          <td className={`py-1.5 px-2 text-right font-medium ${t.pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(0)}
                          </td>
                          <td className={`py-1.5 px-2 uppercase text-[10px] ${t.outcome === "win" ? "text-emerald-500" : "text-red-500"}`}>
                            {t.outcome}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setSelectedDay(null);
                                setChartTrade({
                                  date: t.date,
                                  time: t.time,
                                  direction: t.direction,
                                  entry: t.entry,
                                  stop: t.stop,
                                  target: t.target,
                                  outcome: t.outcome,
                                  ib: t.ib,
                                });

                              }}
                              title="view 15m chart"
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </main>
      </div>
      <TradeChartDialog
        open={!!chartTrade}
        onOpenChange={(v) => !v && setChartTrade(null)}
        trade={chartTrade}
        bars={result?.bars ?? []}
        symbol={result?.symbol ?? ""}
        sessionStartMin={dataSource === "csv" ? 6 * 60 : chartTrade?.ib ? 9 * 60 + 30 : undefined}
        sessionEndMin={dataSource === "csv" ? csvCloseMin : undefined}
        tfMinutes={chartTrade?.ib ? 5 : 15}

      />

    </div>
  );
};

const StatCard = ({ label, value, accent, icon }: { label: string; value: string; accent?: "pos" | "neg"; icon?: React.ReactNode }) => (
  <Card className="p-3">
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground lowercase mb-1">
      {icon}{label}
    </div>
    <div className={`text-lg font-bold ${accent === "pos" ? "text-emerald-500" : accent === "neg" ? "text-red-500" : ""}`}>
      {value}
    </div>
  </Card>
);

export default Backtester;
