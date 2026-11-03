import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Loader2, Play, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import LocalM1Panel from "@/components/LocalM1Panel";
import { loadLocalDataset } from "@/lib/local-m1-store";
import {
  WEEKDAYS, buildDayGrids, equityCurve, fmtMin, parseHHMM, scanWindows, windowTrades,
  walkForwardSplit, yearlyBreakdown, RANK_LABELS,
  type DayGrid, type RankBy, type ScanResult, type WindowStat, type WindowTrade,
} from "@/lib/seasonal-window";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";

const DAY_OPTS = [
  { v: "1", l: "senin" }, { v: "2", l: "selasa" }, { v: "3", l: "rabu" },
  { v: "4", l: "kamis" }, { v: "5", l: "jumat" }, { v: "-1", l: "senin–jumat" },
];

const RANK_OPTS: RankBy[] = ["winRate", "net", "avg", "profitFactor"];

export default function SeasonalWindow() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dataset, setDataset] = useState<string | null>(null);
  const [weekday, setWeekday] = useState("1");
  const [duration, setDuration] = useState("60");
  const [step, setStep] = useState("15");
  const [from, setFrom] = useState("06:00");
  const [to, setTo] = useState("16:00");
  const [minTrades, setMinTrades] = useState("20");
  const [rankBy, setRankBy] = useState<RankBy>("winRate");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<ScanResult | null>(null);
  const [grids, setGrids] = useState<DayGrid[]>([]);
  const [pick, setPick] = useState<{ w: WindowStat; side: "long" | "short" } | null>(null);

  const run = async () => {
    if (!dataset) return toast.error("pilih atau import dataset dulu");
    setLoading(true);
    try {
      const s = await loadLocalDataset(dataset);
      if (!s) throw new Error("dataset tidak ditemukan");
      const wd = +weekday;
      const g = buildDayGrids(s, wd);
      const r = scanWindows(g, {
        weekday: wd, duration: Math.max(1, +duration || 60), step: Math.max(1, +step || 15),
        sessionStart: parseHHMM(from), sessionEnd: parseHHMM(to), minTrades: Math.max(1, +minTrades || 1),
        rankBy,
      });
      if (!r.all.length) toast.error("tidak ada window dengan trade cukup");
      setGrids(g); setRes(r); setPick(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const trades = useMemo(() => {
    if (!pick) return [] as WindowTrade[];
    const sign = pick.side === "long" ? 1 : -1;
    return windowTrades(grids, pick.w.start, pick.w.end)
      .map((t) => ({ ...t, points: t.points * sign }))
      .reverse();
  }, [pick, grids]);

  const chrono = useMemo(() => (trades ? [...trades].reverse() : []), [trades]);
  const eq = useMemo(() => (pick ? equityCurve(chrono) : []), [chrono, pick]);
  const years = useMemo(() => (pick ? yearlyBreakdown(chrono) : []), [chrono, pick]);
  const wf = useMemo(() => (pick ? walkForwardSplit(chrono) : null), [chrono, pick]);

  const chart = useMemo(
    () => (res ? res.all.map((w) => ({ label: fmtMin(w.start), net: Math.round(w.long.net), wr: w.long.winRate })) : []),
    [res]
  );

  const TopList = ({ side, rows }: { side: "long" | "short"; rows: WindowStat[] }) => (
    <Card className="p-4 space-y-2">
      <h3 className="font-semibold lowercase flex items-center gap-2">
        {side === "long" ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        top 5 {side} · {RANK_LABELS[rankBy]}
      </h3>
      {rows.slice(0, 5).map((w, i) => (
        <button key={w.start} onClick={() => setPick({ w, side })}
          className={`w-full grid grid-cols-[24px_1fr_auto] gap-2 items-center rounded border px-3 py-2 text-left text-sm hover:bg-muted/50 ${pick?.w === w ? "border-primary" : "border-border"}`}>
          <span className="text-muted-foreground">#{i + 1}</span>
          <span className="font-mono">{fmtMin(w.start)} – {fmtMin(w.end)}</span>
          <span className="text-right text-xs">
            <span className="font-semibold">{w.winRate.toFixed(1)}%</span>
            <span className="text-muted-foreground"> · {w.wins}/{w.trades}</span>
            <span className={w.net >= 0 ? " text-primary" : " text-destructive"}> · {w.net >= 0 ? "+" : ""}{w.net.toFixed(2)} pts</span>
            <span className="text-muted-foreground"> · pf {isFinite(w.profitFactor) ? w.profitFactor.toFixed(2) : "∞"}</span>
            <span className="text-muted-foreground"> · mae {w.avgMae.toFixed(1)}</span>
          </span>
        </button>
      ))}
    </Card>
  );

  const PeriodTable = ({ rows, title }: { rows: { label: string; trades: number; wins: number; winRate: number; net: number; avg: number }[]; title: string }) => (
    <div>
      <h4 className="text-xs font-semibold lowercase text-muted-foreground mb-1">{title}</h4>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr><th className="text-left p-1">periode</th><th className="text-right p-1">trade</th><th className="text-right p-1">win</th><th className="text-right p-1">win rate</th><th className="text-right p-1">net poin</th><th className="text-right p-1">rata-rata</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="p-1 font-mono">{r.label}</td>
              <td className="p-1 text-right">{r.trades}</td>
              <td className="p-1 text-right">{r.wins}</td>
              <td className="p-1 text-right">{r.winRate.toFixed(1)}%</td>
              <td className={`p-1 text-right font-semibold ${r.net >= 0 ? "text-primary" : "text-destructive"}`}>{r.net >= 0 ? "+" : ""}{r.net.toFixed(2)}</td>
              <td className={`p-1 text-right ${r.avg >= 0 ? "text-primary" : "text-destructive"}`}>{r.avg >= 0 ? "+" : ""}{r.avg.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppNavSidebar
        collapsed={isMobile ? !mobileOpen : collapsed}
        onToggle={() => (isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed))}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && <MobileHeader onMenuToggle={() => setMobileOpen(!mobileOpen)} title="seasonal window" />}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 max-w-[1400px] w-full mx-auto">
          <div>
            <h1 className="text-2xl font-bold lowercase flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" /> seasonal window optimizer
            </h1>
            <p className="text-sm text-muted-foreground lowercase">
              cari jam terbaik buat long / short per hari dari data m1 ninjatrader. entry di open jam mulai, exit di close jam akhir (waktu et).
            </p>
          </div>

          <div className="grid lg:grid-cols-[360px_1fr] gap-4">
            <LocalM1Panel selected={dataset} onSelect={setDataset}
              onChange={(l) => { if (!dataset && l.length) setDataset(l[0].name); }} />

            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><Label className="text-xs lowercase">hari</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAY_OPTS.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs lowercase">durasi (menit)</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["15", "30", "45", "60", "90", "120"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs lowercase">step (menit)</Label>
                  <Select value={step} onValueChange={setStep}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["1", "5", "15", "30", "60"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs lowercase">scan dari (et)</Label><Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div><Label className="text-xs lowercase">sampai (et)</Label><Input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                <div><Label className="text-xs lowercase">min. trade</Label><Input type="number" value={minTrades} onChange={(e) => setMinTrades(e.target.value)} /></div>
                <div className="md:col-span-2"><Label className="text-xs lowercase">kriteria ranking</Label>
                  <Select value={rankBy} onValueChange={(v) => setRankBy(v as RankBy)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RANK_OPTS.map((r) => <SelectItem key={r} value={r}>{RANK_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={run} disabled={loading || !dataset}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} run scan
              </Button>
              {res && (
                <p className="text-xs text-muted-foreground lowercase">
                  {res.days} hari {WEEKDAYS[+weekday] ?? "senin–jumat"} · {res.all.length} window diuji · ranking: {RANK_LABELS[rankBy]}
                </p>
              )}
            </Card>
          </div>

          {res && res.all.length > 0 && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <TopList side="long" rows={res.long} />
                <TopList side="short" rows={res.short} />
              </div>

              <Card className="p-4">
                <h3 className="font-semibold lowercase mb-2">total poin long per jam mulai (negatif = edge short)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        formatter={(v: any, k: any) => (k === "net" ? [`${v} pts`, "net long"] : v)} />
                      <Bar dataKey="net">
                        {chart.map((d, i) => <Cell key={i} fill={d.net >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {pick && (
                <Card className="p-4 space-y-4">
                  <h3 className="font-semibold lowercase">
                    {pick.side} {fmtMin(pick.w.start)} – {fmtMin(pick.w.end)} · {trades.length} hari
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded border border-border p-2">
                      <div className="text-xs text-muted-foreground lowercase">avg mae</div>
                      <div className="font-semibold text-destructive">{pick.w.avgMae.toFixed(2)} pts</div>
                      <div className="text-xs text-muted-foreground">max {pick.w.maxMae.toFixed(2)}</div>
                    </div>
                    <div className="rounded border border-border p-2">
                      <div className="text-xs text-muted-foreground lowercase">avg mfe</div>
                      <div className="font-semibold text-primary">{pick.w.avgMfe.toFixed(2)} pts</div>
                      <div className="text-xs text-muted-foreground">max {pick.w.maxMfe.toFixed(2)}</div>
                    </div>
                    <div className="rounded border border-border p-2">
                      <div className="text-xs text-muted-foreground lowercase">win rate</div>
                      <div className="font-semibold">{pick.w.winRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">{pick.w.wins}/{pick.w.trades}</div>
                    </div>
                    <div className="rounded border border-border p-2">
                      <div className="text-xs text-muted-foreground lowercase">net poin</div>
                      <div className={`font-semibold ${pick.w.net >= 0 ? "text-primary" : "text-destructive"}`}>{pick.w.net >= 0 ? "+" : ""}{pick.w.net.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">pf {isFinite(pick.w.profitFactor) ? pick.w.profitFactor.toFixed(2) : "∞"}</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground lowercase">
                    mae = pergerakan berlawanan terburuk dari entry (risiko intraday), mfe = pergerakan menguntungkan terbaik (potensi target). hitung dari high/low m1 selama posisi terbuka.
                  </p>

                  <div>
                    <h4 className="text-xs font-semibold lowercase text-muted-foreground mb-1">kurva ekuitas (poin kumulatif, kronologis)</h4>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={eq}>
                          <defs>
                            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={40} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                            formatter={(v: any, k: any) => (k === "cum" ? [`${v} pts`, "kumulatif"] : [`${v} pts`, "per trade"])} />
                          <Area type="monotone" dataKey="cum" stroke="hsl(var(--primary))" fill="url(#eqFill)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <PeriodTable rows={years} title="konsistensi tahunan" />
                    {wf && <PeriodTable rows={[wf.first, wf.second]} title="walk-forward (paruh 1 vs paruh 2)" />}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold lowercase text-muted-foreground mb-1">trade log (tanggal terbaru dulu)</h4>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground sticky top-0 bg-card">
                          <tr><th className="text-left p-1">tanggal</th><th className="text-right p-1">entry</th><th className="text-right p-1">exit</th><th className="text-right p-1">poin</th><th className="text-right p-1">mae</th><th className="text-right p-1">mfe</th></tr>
                        </thead>
                        <tbody>
                          {trades.map((t) => (
                            <tr key={t.date} className="border-t border-border">
                              <td className="p-1 font-mono">{t.date}</td>
                              <td className="p-1 text-right">{t.entry.toFixed(2)}</td>
                              <td className="p-1 text-right">{t.exit.toFixed(2)}</td>
                              <td className={`p-1 text-right ${t.points >= 0 ? "text-primary" : "text-destructive"}`}>{t.points >= 0 ? "+" : ""}{t.points.toFixed(2)}</td>
                              <td className="p-1 text-right text-destructive">{t.mae.toFixed(2)}</td>
                              <td className="p-1 text-right text-primary">{t.mfe.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
