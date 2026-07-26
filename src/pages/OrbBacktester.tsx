import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { format, differenceInCalendarDays } from "date-fns";
import { CalendarIcon, Play, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { analyzeORB, type ORBTimeframe, type ORBTrade } from "@/lib/orb-analysis";

/**
 * ORB Backtester
 * Fixed $100 risk per trade. Position size = 100 / |entry - stop|.
 * PnL per trade: RR-based (0.5R → +$50 win / -$100 loss; 1R → +$100 / -$100).
 */

type Ticker = "QQQ" | "GLD";
type RRChoice = "0.5" | "1";

interface ExecRow {
  date: string;
  time: string;
  ticker: Ticker;
  direction: "long" | "short";
  entry: number;
  stop: number;
  positionSize: number;
  pnl: number;
  outcome: "win" | "loss";
}

interface Summary {
  totalTrades: number;
  winRate: number;
  netPnl: number;
  maxDrawdown: number;
  profitFactor: number;
}

const RISK = 100;
const MAX_BATCH_DAYS = 60;
const BATCH_OUTPUTSIZE = 5000;
const BATCH_DELAY_MS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * TODO: swap this for a real Supabase-backed persistence layer.
 * Currently a pure client-side computation over live TwelveData bars.
 */
async function fetchBars(ticker: string, totalDays: number) {
  if (totalDays <= MAX_BATCH_DAYS) {
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
      body: { symbol: ticker, outputsize: String(BATCH_OUTPUTSIZE), key_index: 0 },
    });
    if (error) throw new Error("Failed to fetch market data");
    return data?.values ?? [];
  }
  let all: any[] = [];
  let endDate: string | null = null;
  let remaining = totalDays;
  let i = 0;
  while (remaining > 0) {
    const body: Record<string, any> = { symbol: ticker, outputsize: String(BATCH_OUTPUTSIZE), key_index: i };
    if (endDate) body.end_date = endDate;
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body });
    if (error) throw new Error("Batch fetch failed");
    const values = data?.values;
    if (!values?.length) break;
    all = all.concat(values);
    endDate = values[values.length - 1].datetime;
    remaining -= MAX_BATCH_DAYS;
    i++;
    if (remaining > 0) await sleep(BATCH_DELAY_MS);
  }
  const seen = new Set<string>();
  return all.filter((v) => (seen.has(v.datetime) ? false : (seen.add(v.datetime), true)));
}

function computeSummary(rows: ExecRow[]): Summary {
  if (rows.length === 0) return { totalTrades: 0, winRate: 0, netPnl: 0, maxDrawdown: 0, profitFactor: 0 };
  const wins = rows.filter((r) => r.outcome === "win");
  const losses = rows.filter((r) => r.outcome === "loss");
  const netPnl = rows.reduce((a, r) => a + r.pnl, 0);
  const grossW = wins.reduce((a, r) => a + r.pnl, 0);
  const grossL = Math.abs(losses.reduce((a, r) => a + r.pnl, 0));
  let peak = 0, cum = 0, maxDd = 0;
  for (const r of rows) {
    cum += r.pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDd) maxDd = dd;
  }
  return {
    totalTrades: rows.length,
    winRate: (wins.length / rows.length) * 100,
    netPnl,
    maxDrawdown: maxDd,
    profitFactor: grossL > 0 ? grossW / grossL : wins.length > 0 ? Infinity : 0,
  };
}

const OrbBacktester = () => {
  const { user, loading: authLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [ticker, setTicker] = useState<Ticker>("QQQ");
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d;
  });
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [tf, setTf] = useState<"5" | "15" | "30">("15");
  const [rr, setRr] = useState<RRChoice>("1");
  const [candleMode, setCandleMode] = useState<"momentum" | "any">("any");
  const [slMode, setSlMode] = useState<"full" | "half">("full");
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<ExecRow[]>([]);
  const [ran, setRan] = useState(false);
  const summary = useMemo(() => computeSummary(rows), [rows]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const runBacktest = async () => {
    if (!startDate || !endDate) { toast.error("Pick a start and end date"); return; }
    if (startDate > endDate) { toast.error("Start date must be before end date"); return; }
    setLoading(true);
    try {
      const totalDays = Math.max(1, differenceInCalendarDays(new Date(), startDate) + 5);
      const values = await fetchBars(ticker, totalDays);
      if (!values.length) { toast.error("No market data returned"); return; }

      const timeframe = parseInt(tf) as ORBTimeframe;
      const result = analyzeORB(values as any, timeframe, 0, [1, 2, 3, 4, 5], candleMode, slMode);

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");
      const inRange = result.trades.filter((t) => t.date >= startStr && t.date <= endStr && t.triggered);

      const built: ExecRow[] = inRange
        .map((t: ORBTrade) => {
          const outcome = rr === "0.5" ? t.outcomeTp1 : t.outcomeTp2;
          if (outcome === "open") return null;
          const tp = rr === "0.5" ? t.tp1 : t.tp2;
          const slDist = Math.abs(t.entry - t.stop);
          const tpDist = Math.abs(tp - t.entry);
          const positionSize = RISK / slDist;
          const pnl = outcome === "win" ? RISK * (tpDist / slDist) : -RISK;
          return {
            date: t.date,
            time: t.orbTime,
            ticker,
            direction: t.direction === "bullish" ? "long" as const : "short" as const,
            entry: t.entry,
            stop: t.stop,
            positionSize,
            pnl,
            outcome,
          };
        })
        .filter((r): r is ExecRow => r !== null)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

      setRows(built);
      setRan(true);
      if (built.length === 0) toast.info("No resolved trades in the selected range");
      else toast.success(`Backtest complete: ${built.length} trades`);
    } catch (e: any) {
      toast.error(e.message || "Backtest failed");
    } finally {
      setLoading(false);
    }
  };

  const fmt$ = (n: number) => (n >= 0 ? "$" : "-$") + Math.abs(n).toFixed(2);
  const fmtPrice = (n: number) => n.toFixed(2);

  return (
    <div className="min-h-screen flex bg-background">
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="flex-1 flex flex-col min-w-0">
        <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="orb backtester" />

        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <header className="space-y-1">
            <p className="section-label">strategy lab</p>
            <h1 className="text-2xl font-bold tracking-tight">opening range breakout backtester</h1>
            <p className="text-sm text-muted-foreground">
              historical probabilities with strict $100 fixed risk per trade. position size sized dynamically to the orb range.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 lg:gap-6">
            {/* Parameters */}
            <Card className="p-4 space-y-4 h-fit">
              <div className="space-y-1">
                <p className="section-label">parameters</p>
                <p className="text-xs text-muted-foreground">configure the backtest</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">instrument ticker</Label>
                <Select value={ticker} onValueChange={(v) => setTicker(v as Ticker)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QQQ">QQQ · Nasdaq 100 ETF</SelectItem>
                    <SelectItem value="GLD">GLD · Gold ETF</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">start date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start font-normal text-xs", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        {startDate ? format(startDate, "MMM d, yyyy") : "pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">end date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start font-normal text-xs", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        {endDate ? format(endDate, "MMM d, yyyy") : "pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">orb timeframe</Label>
                <Select value={tf} onValueChange={(v) => setTf(v as "5" | "15" | "30")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5-min opening range</SelectItem>
                    <SelectItem value="15">15-min opening range</SelectItem>
                    <SelectItem value="30">30-min opening range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">take profit</Label>
                <Select value={rr} onValueChange={(v) => setRr(v as RRChoice)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5 R (half of range)</SelectItem>
                    <SelectItem value="1">1 R (full range)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">risk per trade</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary/40">
                  <Badge variant="outline" className="text-[10px] tracking-wider">fixed</Badge>
                  <span className="text-sm font-semibold">$100.00</span>
                </div>
              </div>

              <Button onClick={runBacktest} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                {loading ? "running..." : "run backtest"}
              </Button>
            </Card>

            {/* Right column */}
            <div className="space-y-4 lg:space-y-6 min-w-0">
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <MetricCard label="total trades" value={ran ? String(summary.totalTrades) : "—"} />
                <MetricCard label="win rate" value={ran ? `${summary.winRate.toFixed(1)}%` : "—"} tone={summary.winRate >= 50 ? "pos" : "neg"} disabled={!ran} />
                <MetricCard label="net pnl" value={ran ? fmt$(summary.netPnl) : "—"} tone={summary.netPnl >= 0 ? "pos" : "neg"} disabled={!ran} />
                <MetricCard label="max drawdown" value={ran ? fmt$(-summary.maxDrawdown) : "—"} tone="neg" disabled={!ran} />
                <MetricCard label="profit factor" value={ran ? (isFinite(summary.profitFactor) ? summary.profitFactor.toFixed(2) : "∞") : "—"} tone={summary.profitFactor >= 1 ? "pos" : "neg"} disabled={!ran} />
              </div>

              {/* Table */}
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="section-label">execution history</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ran ? `${rows.length} resolved trade${rows.length === 1 ? "" : "s"} · rr ${rr}` : "no backtest yet"}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">date & time</TableHead>
                        <TableHead className="text-xs">ticker</TableHead>
                        <TableHead className="text-xs">bias</TableHead>
                        <TableHead className="text-xs text-right">entry</TableHead>
                        <TableHead className="text-xs text-right">stop loss</TableHead>
                        <TableHead className="text-xs text-right">position size</TableHead>
                        <TableHead className="text-xs text-right">pnl</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-10">
                            {ran ? "no resolved trades in range" : "run a backtest to see execution history"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs whitespace-nowrap">
                              <div className="font-medium">{r.date}</div>
                              <div className="text-muted-foreground">{r.time} ny</div>
                            </TableCell>
                            <TableCell className="text-xs font-medium">{r.ticker}</TableCell>
                            <TableCell>
                              <span className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                                r.direction === "long" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              )}>
                                {r.direction === "long" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {r.direction}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">{fmtPrice(r.entry)}</TableCell>
                            <TableCell className="text-xs text-right font-mono text-muted-foreground">{fmtPrice(r.stop)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{r.positionSize.toFixed(2)}</TableCell>
                            <TableCell className={cn("text-xs text-right font-mono font-semibold", r.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {fmt$(r.pnl)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, tone, disabled }: { label: string; value: string; tone?: "pos" | "neg"; disabled?: boolean }) => (
  <Card className="p-3 lg:p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
    <p className={cn(
      "text-lg lg:text-2xl font-bold mt-1 font-mono tabular-nums",
      disabled && "text-muted-foreground",
      !disabled && tone === "pos" && "text-emerald-500",
      !disabled && tone === "neg" && "text-rose-500",
    )}>
      {value}
    </p>
  </Card>
);

export default OrbBacktester;
