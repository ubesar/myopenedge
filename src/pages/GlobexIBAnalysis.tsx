import { useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowUpDown, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { analyzeGlobexIB } from "@/lib/globex-ib-engine";
import type {
  GlobexIBWindow,
  GlobexIBResult,
  GlobexIBStats,
  ConditionalBreakdown,
  DataProvider,
  NormalizedBar,
} from "@/types/globex-ib";

const IB_WINDOWS: { value: string; label: string }[] = [
  { value: "30", label: "30 min (18:00–18:30)" },
  { value: "60", label: "60 min (18:00–19:00)" },
  { value: "120", label: "120 min (18:00–20:00)" },
  { value: "180", label: "180 min (18:00–21:00)" },
];

const DATE_RANGES = [
  { value: "20", label: "1 Month" },
  { value: "40", label: "2 Months" },
  { value: "60", label: "3 Months" },
  { value: "120", label: "6 Months" },
  { value: "240", label: "12 Months" },
];

type SortKey = keyof GlobexIBResult;
type SortDir = "asc" | "desc";

const BreakdownTable = ({ title, data }: { title: string; data: ConditionalBreakdown[] }) => {
  if (data.length === 0) return null;
  return (
    <Card className="border-border/30 bg-card/40 backdrop-blur-md">
      <CardHeader className="px-3 py-2 border-b border-border/20">
        <CardTitle className="text-xs font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/20">
                <TableHead className="text-[10px] h-8 px-2">condition</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-center">days</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-center text-emerald-400">▲ break high</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-center text-red-400">▼ break low</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-center text-muted-foreground">inside</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.label} className="border-border/10">
                  <TableCell className="text-[11px] font-medium px-2 py-1.5">{row.label.replace(/_/g, " ").toLowerCase()}</TableCell>
                  <TableCell className="text-[11px] text-center px-2 py-1.5">{row.total}</TableCell>
                  <TableCell className="text-[11px] text-center px-2 py-1.5 text-emerald-400 font-semibold">{row.breakHighPct.toFixed(1)}%</TableCell>
                  <TableCell className="text-[11px] text-center px-2 py-1.5 text-red-400 font-semibold">{row.breakLowPct.toFixed(1)}%</TableCell>
                  <TableCell className="text-[11px] text-center px-2 py-1.5 text-muted-foreground">{row.insidePct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

const StatCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
  <div className="rounded-lg border border-border/30 bg-card/40 backdrop-blur-md px-3 py-2">
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

const GlobexIBAnalysis = () => {
  const { user, loading: authLoading } = useAuth();
  const { isActive } = useSubscription();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ticker, setTicker] = useState("NQ");
  const [ibWindow, setIbWindow] = useState<GlobexIBWindow>(60);
  const [maxDays, setMaxDays] = useState(60);
  const [provider, setProvider] = useState<DataProvider>("twelvedata");

  const [results, setResults] = useState<GlobexIBResult[]>([]);
  const [stats, setStats] = useState<GlobexIBStats | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rthDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showSettings, setShowSettings] = useState(false);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const BATCH_DELAY_MS = 3000;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const fetchTwelveData = async (sym: string, totalDays: number): Promise<NormalizedBar[]> => {
    // Need extended hours (prepost) data for Globex session
    // Fetch in batches of 5000 bars
    let allBars: NormalizedBar[] = [];
    let endDate: string | null = null;
    let remaining = totalDays;
    let batchIndex = 0;
    const batchDays = 60;

    while (remaining > 0) {
      const body: Record<string, string> = {
        symbol: sym,
        interval: "5min",
        outputsize: "5000",
        key_index: String(batchIndex),
      };
      if (endDate) body.end_date = endDate;

      const { data, error } = await supabase.functions.invoke("twelvedata-bars", { body });
      if (error) throw new Error("Failed to fetch data (batch " + (batchIndex + 1) + ")");
      if (data?.error) throw new Error(data.error);

      const bars: NormalizedBar[] = data?.results || [];
      if (bars.length === 0) break;

      allBars = allBars.concat(bars);

      // Oldest bar for next batch
      const oldest = bars[bars.length - 1];
      endDate = oldest.datetime;

      remaining -= batchDays;
      batchIndex++;

      if (remaining > 0) await sleep(BATCH_DELAY_MS);
    }

    // Dedup by timestamp
    const seen = new Set<number>();
    return allBars.filter((b) => {
      if (seen.has(b.timestamp)) return false;
      seen.add(b.timestamp);
      return true;
    });
  };

  const fetchMassiveData = async (sym: string, totalDays: number): Promise<NormalizedBar[]> => {
    const to = new Date();
    const from = new Date(to.getTime() - totalDays * 24 * 60 * 60 * 1000);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const { data, error } = await supabase.functions.invoke("massive-bars", {
      body: { symbol: sym, from: fromStr, to: toStr, multiplier: "5", timespan: "minute", asset_type: "futures" },
    });

    if (error) throw new Error("Failed to fetch from Massive API");
    if (data?.error) throw new Error(data.error);

    return (data?.results || []).map((b: any) => ({
      timestamp: b.timestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      datetime: new Date(b.timestamp).toISOString(),
    }));
  };

  const handleRun = async () => {
    setLoading(true);
    setResults([]);
    setStats(null);

    try {
      let bars: NormalizedBar[];
      if (provider === "massive") {
        bars = await fetchMassiveData(ticker, maxDays);
      } else {
        bars = await fetchTwelveData(ticker, maxDays);
      }

      if (bars.length === 0) {
        toast.error("No data returned.");
        return;
      }

      const analysis = analyzeGlobexIB(bars, ibWindow, maxDays);
      if (analysis.results.length === 0) {
        toast.error("Not enough data for analysis.");
        return;
      }

      setResults(analysis.results);
      setStats(analysis.stats);
      toast.success(`Analyzed ${analysis.results.length} trading days`);
    } catch (err: any) {
      toast.error(err?.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [results, sortKey, sortDir]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="text-[10px] h-8 px-2 cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-0.5">
        {label}
        {sortKey === field ? (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );

  const outcomeColor = (outcome: string) => {
    if (outcome === "BREAK_HIGH") return "text-emerald-400";
    if (outcome === "BREAK_LOW") return "text-red-400";
    return "text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background flex">
      {!isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
      {isMobile && <MobileHeader onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} title="globex ib" />}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar with nav */}
        <div className="border-b border-border/30 bg-card/20 px-4 py-2 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate("/app")}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← rth ib analysis
          </button>
          <span className="text-border">|</span>
          <span className="text-[11px] font-semibold text-primary">globex ib analysis</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* Controls */}
          <Card className="border-border/30 bg-card/40 backdrop-blur-md">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">ticker</Label>
                  <Input
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="w-24 h-8 text-xs bg-input border-border/30"
                    placeholder="NQ"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">ib window</Label>
                  <Select value={String(ibWindow)} onValueChange={(v) => setIbWindow(Number(v) as GlobexIBWindow)}>
                    <SelectTrigger className="w-44 h-8 text-xs bg-input border-border/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IB_WINDOWS.map((w) => (
                        <SelectItem key={w.value} value={w.value} className="text-xs">{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">date range</Label>
                  <Select value={String(maxDays)} onValueChange={(v) => setMaxDays(Number(v))}>
                    <SelectTrigger className="w-28 h-8 text-xs bg-input border-border/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGES.map((d) => (
                        <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">data source</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as DataProvider)}>
                    <SelectTrigger className="w-32 h-8 text-xs bg-input border-border/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twelvedata" className="text-xs">TwelveData</SelectItem>
                      <SelectItem value="massive" className="text-xs">Massive (Polygon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleRun}
                  disabled={loading || !ticker}
                  className="h-8 text-xs px-4"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {loading ? "analyzing..." : "run analysis"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats overview */}
          {stats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                <StatCard label="total days" value={String(stats.totalDays)} />
                <StatCard label="break high" value={`${stats.breakHighPct.toFixed(1)}%`} sub={`${stats.breakHigh} days`} color="text-emerald-400" />
                <StatCard label="break low" value={`${stats.breakLowPct.toFixed(1)}%`} sub={`${stats.breakLow} days`} color="text-red-400" />
                <StatCard label="inside" value={`${stats.insidePct.toFixed(1)}%`} sub={`${stats.inside} days`} />
              </div>

              {/* Conditional breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <BreakdownTable title="by rth open position" data={stats.byRTHOpenPosition} />
                <BreakdownTable title="by globex ib break direction" data={stats.byGlobexBreakDirection} />
                <BreakdownTable title="by first test" data={stats.byFirstTest} />
              </div>
            </>
          )}

          {/* Results table */}
          {sortedResults.length > 0 && (
            <Card className="border-border/30 bg-card/40 backdrop-blur-md">
              <CardHeader className="px-3 py-2 border-b border-border/20">
                <CardTitle className="text-xs font-semibold">📊 daily results — {ticker} · {sortedResults.length} days</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/20">
                        <SortHeader label="date" field="rthDate" />
                        <SortHeader label="globex H" field="globexHigh" />
                        <SortHeader label="globex L" field="globexLow" />
                        <SortHeader label="IB H" field="globexIBHigh" />
                        <SortHeader label="IB L" field="globexIBLow" />
                        <SortHeader label="IB range" field="globexIBRange" />
                        <SortHeader label="glx break" field="globexBreakDirection" />
                        <SortHeader label="rth open" field="rthOpen" />
                        <SortHeader label="open pos" field="rthOpenPosition" />
                        <SortHeader label="outcome" field="rthOutcome" />
                        <SortHeader label="1st test" field="rthFirstTest" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedResults.map((row) => (
                        <TableRow key={row.rthDate} className="border-border/10 hover:bg-muted/20">
                          <TableCell className="text-[11px] font-medium px-2 py-1.5">{row.rthDate}</TableCell>
                          <TableCell className="text-[11px] px-2 py-1.5">{row.globexHigh.toFixed(2)}</TableCell>
                          <TableCell className="text-[11px] px-2 py-1.5">{row.globexLow.toFixed(2)}</TableCell>
                          <TableCell className="text-[11px] px-2 py-1.5">{row.globexIBHigh.toFixed(2)}</TableCell>
                          <TableCell className="text-[11px] px-2 py-1.5">{row.globexIBLow.toFixed(2)}</TableCell>
                          <TableCell className="text-[11px] px-2 py-1.5">{row.globexIBRange.toFixed(2)}</TableCell>
                          <TableCell className={`text-[11px] px-2 py-1.5 font-semibold ${outcomeColor(row.globexBreakDirection)}`}>
                            {row.globexBreakDirection.replace(/_/g, " ").toLowerCase()}
                          </TableCell>
                          <TableCell className="text-[11px] px-2 py-1.5">{row.rthOpen.toFixed(2)}</TableCell>
                          <TableCell className="text-[11px] px-2 py-1.5">{row.rthOpenPosition.replace(/_/g, " ").toLowerCase()}</TableCell>
                          <TableCell className={`text-[11px] px-2 py-1.5 font-semibold ${outcomeColor(row.rthOutcome)}`}>
                            {row.rthOutcome === "BREAK_HIGH" ? "▲ high" : row.rthOutcome === "BREAK_LOW" ? "▼ low" : "— inside"}
                          </TableCell>
                          <TableCell className={`text-[11px] px-2 py-1.5 ${row.rthFirstTest === "HIGH" ? "text-emerald-400" : row.rthFirstTest === "LOW" ? "text-red-400" : "text-muted-foreground"}`}>
                            {row.rthFirstTest.toLowerCase()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">configure parameters above and click "run analysis"</p>
              <p className="text-xs text-muted-foreground mt-1">globex ib tracks overnight initial balance vs rth breakout</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobexIBAnalysis;
