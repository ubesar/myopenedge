import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, Radar, ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  PEER_BREADTH_UNIVERSE, DEFAULT_PEER_BREADTH_CONFIG, runPeerBreadthBacktest, computePeerBreadthLive,
  type SymbolData, type PeerBreadthResult, type PeerBreadthLive,
} from "@/lib/peer-breadth";

const CHUNK = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fmtUsd = (v: number) =>
  `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const Metric = ({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`text-[15px] font-semibold ${tone === "up" ? "text-emerald-500" : tone === "down" ? "text-red-500" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

const PeerBreadth = () => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);

  const [startDate, setStartDate] = useState("2025-01-01");
  const [useFunding, setUseFunding] = useState(true);
  const [startEquity, setStartEquity] = useState("100000");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<PeerBreadthResult | null>(null);
  const [live, setLive] = useState<PeerBreadthLive | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const loadingRef = useRef(false);

  const equityChart = useMemo(
    () => (result?.equity || []).map((e) => ({ date: e.date, equity: Math.round(e.equity) })),
    [result]
  );
  const ddChart = useMemo(() => {
    let peak = -Infinity;
    return (result?.equity || []).map((e) => {
      peak = Math.max(peak, e.equity);
      return { date: e.date, dd: ((e.equity / peak - 1) * 100) };
    });
  }, [result]);

  const run = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      // download at least breadth + ATR warmup before the sim window
      const fetchStart = new Date(Date.parse(`${startDate}T00:00:00Z`) - 60 * 86_400_000)
        .toISOString().slice(0, 10);
      const data: Record<string, SymbolData> = {};
      for (let i = 0; i < PEER_BREADTH_UNIVERSE.length; i += CHUNK) {
        const chunk = PEER_BREADTH_UNIVERSE.slice(i, i + CHUNK);
        setProgress(`mengambil data ${i + 1}-${Math.min(i + CHUNK, PEER_BREADTH_UNIVERSE.length)} dari ${PEER_BREADTH_UNIVERSE.length} koin…`);
        const { data: res, error } = await supabase.functions.invoke("binance-daily", {
          body: { symbols: chunk, start: fetchStart, funding: useFunding },
        });
        if (error) throw new Error(error.message || "gagal mengambil data binance");
        if (res?.error) throw new Error(res.error);
        for (const [sym, payload] of Object.entries(res.data as Record<string, SymbolData>)) {
          if (payload?.bars?.length) data[sym] = payload;
        }
        if (i + CHUNK < PEER_BREADTH_UNIVERSE.length) await sleep(400);
      }

      const loaded = Object.keys(data).length;
      if (loaded < 10) throw new Error(`hanya ${loaded} koin yang berhasil diambil`);

      setProgress("menjalankan backtest…");
      await sleep(30);
      const cfg = {
        ...DEFAULT_PEER_BREADTH_CONFIG,
        useFunding,
        startEquity: Math.max(1000, Number(startEquity) || 100000),
      };
      const r = runPeerBreadthBacktest(data, cfg, startDate);
      setResult(r);
      setLive(computePeerBreadthLive(data, cfg));
      setLastRunAt(new Date());
      toast.success(`${r.stats.trades} trade dari ${r.signals.length} sinyal (${loaded} koin)`);
    } catch (e: any) {
      toast.error(e?.message || "gagal menjalankan peer breadth");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setProgress("");
    }
  }, [startDate, useFunding, startEquity]);

  // auto-run saat halaman dibuka + refresh ulang setiap jam
  useEffect(() => {
    run();
    if (!autoRefresh) return;
    const id = setInterval(run, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [run, autoRefresh]);

  const s = result?.stats;

  return (
    <div className="min-h-screen flex bg-background">
      {isMobile && <MobileHeader onMenuToggle={() => setCollapsed(!collapsed)} title="peer breadth" />}
      {!isMobile && <AppNavSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />}
      {isMobile && <AppNavSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />}

      <main className={`flex-1 min-w-0 overflow-y-auto ${isMobile ? "pt-14" : ""}`}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-5 space-y-5">
          {/* header */}
          <header className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              <h1 className="text-[18px] sm:text-[22px] font-semibold lowercase">peer breadth diffusion</h1>
            </div>
            <p className="text-[12px] text-muted-foreground max-w-3xl">
              candidate 18 — aturan mekanis penuh pada 20 perpetual usdt binance. sinyal muncul saat partisipasi
              pasar (breadth) melintasi 70% dan koin itu sendiri ikut bergerak searah. data harian utc dari
              arsip publik binance.
            </p>
            <a
              href="https://milkmantrades.com/peer-breadth.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              sumber: milkmantrades.com/peer-breadth.html <ExternalLink className="h-3 w-3" />
            </a>
          </header>

          {/* controls */}
          <Card className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-[11px] lowercase">mulai dari</Label>
                <Select value={startDate} onValueChange={setStartDate}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-01-01">2026 ytd</SelectItem>
                    <SelectItem value="2025-01-01">2025 → sekarang</SelectItem>
                    <SelectItem value="2024-01-01">2024 → sekarang</SelectItem>
                    <SelectItem value="2023-01-01">2023 → sekarang</SelectItem>
                    <SelectItem value="2022-01-01">2022 → sekarang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] lowercase">modal awal (usd)</Label>
                <Select value={startEquity} onValueChange={setStartEquity}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10000">$10,000</SelectItem>
                    <SelectItem value="25000">$25,000</SelectItem>
                    <SelectItem value="50000">$50,000</SelectItem>
                    <SelectItem value="100000">$100,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-center gap-1.5 h-9">
                <div className="flex items-center gap-2">
                  <Switch checked={useFunding} onCheckedChange={setUseFunding} id="funding" />
                  <Label htmlFor="funding" className="text-[11px] lowercase">funding 8 jam</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="autorefresh" />
                  <Label htmlFor="autorefresh" className="text-[11px] lowercase">auto-refresh tiap jam</Label>
                </div>
              </div>
              <Button onClick={run} disabled={loading} className="h-9 text-[12px] lowercase">
                {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
                {loading ? progress || "memproses…" : "jalankan"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              biaya 20 bp bolak-balik (10 bp per sisi), risiko 0.25% ekuitas per sinyal, batas risiko terbuka 1.5%,
              gross maksimal 2× ekuitas, satu posisi per koin.
              {lastRunAt && (
                <span className="block mt-0.5">
                  terakhir diperbarui: {lastRunAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  {autoRefresh ? " — diperbarui otomatis setiap jam" : ""}
                </span>
              )}
            </p>
          </Card>

          {/* results */}
          {s && result && (
            <Tabs defaultValue="overview">
              <TabsList className="h-9">
                <TabsTrigger value="overview" className="text-[12px] lowercase">ringkasan</TabsTrigger>
                <TabsTrigger value="signals" className="text-[12px] lowercase">sinyal terbaru</TabsTrigger>
                <TabsTrigger value="trades" className="text-[12px] lowercase">trade</TabsTrigger>
                <TabsTrigger value="coins" className="text-[12px] lowercase">per koin</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  <Metric label="return" value={fmtPct(s.returnPct)} tone={s.returnPct >= 0 ? "up" : "down"} />
                  <Metric label="net pnl" value={fmtUsd(s.netPnl)} tone={s.netPnl >= 0 ? "up" : "down"} />
                  <Metric label="trade" value={String(s.trades)} />
                  <Metric label="win rate" value={`${s.winRate.toFixed(1)}%`} />
                  <Metric label="profit factor" value={s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)} />
                  <Metric label="max drawdown" value={`${s.maxDrawdownPct.toFixed(2)}%`} tone="down" />
                  <Metric label="sharpe" value={s.sharpe.toFixed(2)} />
                  <Metric label="sortino" value={s.sortino.toFixed(2)} />
                  <Metric label="calmar" value={s.calmar.toFixed(2)} />
                  <Metric label="cagr" value={`${s.cagr.toFixed(2)}%`} />
                  <Metric label="avg trade" value={fmtUsd(s.avgTrade)} />
                  <Metric label="time in market" value={`${s.timeInMarketPct.toFixed(0)}%`} />
                </div>

                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground lowercase mb-2">kurva ekuitas</p>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={equityChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                        <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} width={60} />
                        <Tooltip contentStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.6} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground lowercase mb-2">drawdown (%)</p>
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ddChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                        <YAxis tick={{ fontSize: 10 }} width={50} />
                        <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => `${v.toFixed(2)}%`} />
                        <Area type="monotone" dataKey="dd" stroke="#ef4444" fill="#ef444433" strokeWidth={1.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground lowercase mb-2">alasan keluar posisi</p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {Object.entries(s.reasonCounts).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="signals" className="mt-4">
                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground lowercase mb-2">
                    sinyal pada bar terakhir ({result.equity[result.equity.length - 1]?.date}) — entry di open hari berikutnya
                  </p>
                  {result.latestSignals.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">tidak ada sinyal pada bar terakhir.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead className="text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="text-left py-1.5">koin</th>
                            <th className="text-left">arah</th>
                            <th className="text-right">close</th>
                            <th className="text-right">stop %</th>
                            <th className="text-right">target %</th>
                            <th className="text-right">breadth</th>
                            <th className="text-right">return 5d</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.latestSignals.map((sig) => (
                            <tr key={sig.symbol + sig.date} className="border-b border-border/50">
                              <td className="py-1.5 font-medium">{sig.symbol.replace("USDT", "")}</td>
                              <td className={sig.side === 1 ? "text-emerald-500" : "text-red-500"}>
                                <span className="inline-flex items-center gap-1">
                                  {sig.side === 1 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                  {sig.side === 1 ? "long" : "short"}
                                </span>
                              </td>
                              <td className="text-right">{sig.close}</td>
                              <td className="text-right">{(sig.stopPct * 100).toFixed(2)}%</td>
                              <td className="text-right">{(sig.stopPct * 300).toFixed(2)}%</td>
                              <td className="text-right">
                                {((sig.side === 1 ? sig.positiveShare : sig.negativeShare) * 100).toFixed(0)}%
                              </td>
                              <td className="text-right">{(sig.ownReturn * 100).toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="trades" className="mt-4">
                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground lowercase mb-2">
                    {result.trades.length} trade (terbaru di atas)
                  </p>
                  <div className="overflow-x-auto max-h-[520px]">
                    <table className="w-full text-[11px]">
                      <thead className="text-muted-foreground sticky top-0 bg-card">
                        <tr className="border-b border-border">
                          <th className="text-left py-1.5">entry</th>
                          <th className="text-left">koin</th>
                          <th className="text-left">arah</th>
                          <th className="text-right">harga</th>
                          <th className="text-right">stop</th>
                          <th className="text-right">target</th>
                          <th className="text-left">exit</th>
                          <th className="text-left">alasan</th>
                          <th className="text-right">r</th>
                          <th className="text-right">net pnl</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...result.trades].reverse().map((t, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1.5">{t.entryDate}</td>
                            <td className="font-medium">{t.symbol.replace("USDT", "")}</td>
                            <td className={t.side === 1 ? "text-emerald-500" : "text-red-500"}>
                              {t.side === 1 ? "long" : "short"}
                            </td>
                            <td className="text-right">{t.entry.toPrecision(6)}</td>
                            <td className="text-right">{t.stop.toPrecision(6)}</td>
                            <td className="text-right">{t.target.toPrecision(6)}</td>
                            <td>{t.exitDate}</td>
                            <td className="text-muted-foreground">{t.reason}</td>
                            <td className={`text-right ${t.rMultiple >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              {t.rMultiple.toFixed(2)}
                            </td>
                            <td className={`text-right ${t.netPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              {fmtUsd(t.netPnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="coins" className="mt-4">
                <Card className="p-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="text-left py-1.5">koin</th>
                          <th className="text-right">trade</th>
                          <th className="text-right">win rate</th>
                          <th className="text-right">net pnl</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.perSymbol.map((p) => (
                          <tr key={p.symbol} className="border-b border-border/50">
                            <td className="py-1.5 font-medium">{p.symbol.replace("USDT", "")}</td>
                            <td className="text-right">{p.trades}</td>
                            <td className="text-right">{p.winRate.toFixed(1)}%</td>
                            <td className={`text-right ${p.netPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              {fmtUsd(p.netPnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* rules */}
          <Card className="p-4 space-y-3 text-[12px] leading-relaxed">
            <h2 className="text-[14px] font-semibold lowercase">aturan (mekanis penuh, tanpa diskresi)</h2>
            <p className="text-muted-foreground">
              semesta: 20 perpetual usdt binance — {PEER_BREADTH_UNIVERSE.map((s) => s.replace("USDT", "")).join(", ")}.
              bar harian utc.
            </p>
            <div>
              <p className="font-medium lowercase">sinyal (dinilai setiap close harian, per koin)</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1 mt-1">
                <li>peer = 19 koin lain; peer dihitung hanya jika punya return 5 hari lengkap hari ini dan kemarin; minimal 16 dari 19 layak.</li>
                <li>long: porsi peer positif hari ini ≥ 70% sementara kemarin &lt; 70%, return 5 hari koin itu &gt; 0, dan close hari ini di atas close kemarin. short adalah cerminannya.</li>
                <li>jarak stop = 2.5 × atr(14) rata-rata sederhana, minimal 0.5%; sinyal dilewati bila lebih lebar dari 20%.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium lowercase">trade</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1 mt-1">
                <li>entry di open hari berikutnya setelah sinyal; stop pada jarak stop, target 3r, exit terjadwal di open hari ke-14.</li>
                <li>satu posisi terbuka per koin; sinyal pada koin yang sedang dipegang dilewati.</li>
                <li>bila stop dan target sama-sama tersentuh dalam satu bar harian, stop dianggap lebih dulu (konservatif).</li>
              </ul>
            </div>
            <div>
              <p className="font-medium lowercase">akun</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1 mt-1">
                <li>setiap sinyal meminta 0.25% ekuitas open-time diukur ke stop, termasuk cadangan biaya 20 bp.</li>
                <li>semua sinyal di hari yang sama diskalakan pro-rata agar risiko terbuka ≤ 1.5% ekuitas dan gross notional ≤ 2× ekuitas.</li>
                <li>order di bawah $100 notional tidak dipasang; biaya 20 bp bolak-balik plus funding 8 jam yang benar-benar terjadi.</li>
              </ul>
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
              catatan: semesta koin dipilih pada agustus 2026 lalu diterapkan ke semua periode, jadi ada bias
              survivorship. hanya untuk edukasi, bukan nasihat keuangan.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PeerBreadth;
