import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Trash2, Database, HardDriveDownload } from "lucide-react";
import {
  DATA_SOURCE_INTERVALS,
  DataSourceInterval,
  DatasetSummary,
  barsToCsv,
  deleteDataset,
  downloadCsv,
  downloadMonth,
  getDataSourceMode,
  type DataSourceMode,
  listDatasets,
  loadStoredBars,
  monthsInRange,
  setDataSourceMode,
} from "@/lib/data-source";

const QUICK_SYMBOLS = ["QQQ", "GLD", "SPY", "AAPL", "NVDA", "TSLA"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2009 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
// twelvedata free tier: 8 credits/minute -> ~1 request per 8s
const BATCH_DELAY_MS = 8500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RangeMode = "month" | "year" | "range";

const DataSourcePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);

  const [symbol, setSymbol] = useState("QQQ");
  const [interval, setIntervalValue] = useState<DataSourceInterval>("5min");
  const [rangeMode, setRangeMode] = useState<RangeMode>("year");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [fromYear, setFromYear] = useState(String(CURRENT_YEAR - 1));
  const [toYear, setToYear] = useState(String(CURRENT_YEAR));

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [mode, setMode] = useState(getDataSourceMode());

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const refresh = async () => {
    try {
      setDatasets(await listDatasets());
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  const periods = useMemo(() => {
    if (rangeMode === "month") return [`${year}-${month}`];
    if (rangeMode === "year") return monthsInRange(`${year}-01`, `${year}-12`);
    const a = Number(fromYear) <= Number(toYear) ? fromYear : toYear;
    const b = Number(fromYear) <= Number(toYear) ? toYear : fromYear;
    return monthsInRange(`${a}-01`, `${b}-12`);
  }, [rangeMode, month, year, fromYear, toYear]);

  const runDownload = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return toast.error("symbol wajib diisi");
    setBusy(true);
    let saved = 0;
    let failed = 0;
    try {
      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        setProgress({ done: i, total: periods.length, label: p });
        try {
          saved += await downloadMonth(sym, interval, p);
        } catch (e: any) {
          failed++;
          console.error(p, e);
        }
        if (i < periods.length - 1) await sleep(BATCH_DELAY_MS);
      }
      setProgress({ done: periods.length, total: periods.length, label: "selesai" });
      toast.success(`${saved.toLocaleString()} bar tersimpan${failed ? ` · ${failed} periode gagal` : ""}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async (d: DatasetSummary) => {
    try {
      const bars = await loadStoredBars(d.symbol, d.interval);
      downloadCsv(`${d.symbol}_${d.interval}.csv`, barsToCsv(bars));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeDataset = async (d: DatasetSummary) => {
    try {
      await deleteDataset(d.symbol, d.interval);
      toast.success("data source dihapus");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleMode = (m: DataSourceMode) => {
    setDataSourceMode(m);
    setMode(m);
    toast.success(
      m === "stored"
        ? "semua halaman memakai data tersimpan"
        : m === "live"
        ? "semua halaman memakai data live"
        : "otomatis: pakai data tersimpan bila ada"
    );
  };

  if (loading || !user) return null;

  const est = periods.length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-background">
      {isMobile && <MobileHeader onMenuToggle={() => setCollapsed(!collapsed)} title="data source" />}
      <AppNavSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground lowercase">data source</h1>
          <p className="text-[12px] text-muted-foreground">
            download & simpan data ohlc dari twelvedata, lalu pakai di edge lab, backtester dan chart.
          </p>
        </div>

        {/* mode */}
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">sumber data aktif</span>
          {(["auto", "stored", "live"] as const).map((m) => (
            <button
              key={m}
              onClick={() => toggleMode(m)}
              className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "auto" ? "otomatis" : m === "live" ? "live api" : "data tersimpan"}
            </button>
          ))}
          <span className="text-[11px] text-muted-foreground">
            otomatis: /app, /backtester & /chart pakai data tersimpan bila tersedia, selain itu live api.
          </span>
        </Card>

        {/* downloader */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground lowercase">symbol</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="h-8 w-28 text-[13px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground lowercase">interval</label>
              <select
                value={interval}
                onChange={(e) => setIntervalValue(e.target.value as DataSourceInterval)}
                className="h-8 rounded-md border border-border bg-background px-2 text-[13px]"
              >
                {DATA_SOURCE_INTERVALS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground lowercase">tipe import</label>
              <select
                value={rangeMode}
                onChange={(e) => setRangeMode(e.target.value as RangeMode)}
                className="h-8 rounded-md border border-border bg-background px-2 text-[13px]"
              >
                <option value="month">bulanan</option>
                <option value="year">tahunan</option>
                <option value="range">range tahun</option>
              </select>
            </div>

            {rangeMode === "month" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground lowercase">bulan</label>
                <div className="flex gap-1">
                  <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]">
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={year} onChange={(e) => setYear(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]">
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            {rangeMode === "year" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground lowercase">tahun</label>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]">
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {rangeMode === "range" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground lowercase">range tahun</label>
                <div className="flex items-center gap-1">
                  <select value={fromYear} onChange={(e) => setFromYear(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]">
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="text-[12px] text-muted-foreground">s/d</span>
                  <select value={toYear} onChange={(e) => setToYear(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]">
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            <Button onClick={runDownload} disabled={busy} size="sm" className="h-8 gap-1.5">
              <HardDriveDownload className="h-3.5 w-3.5" />
              {busy ? "downloading…" : "download data source"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  symbol === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {est} periode bulanan akan diunduh (± {Math.ceil((est * BATCH_DELAY_MS) / 1000)} detik, 1 api key dibagi per bulan).
          </p>

          {progress && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {progress.done}/{progress.total} · {progress.label}
              </p>
            </div>
          )}
        </Card>

        {/* stored datasets */}
        <Card className="p-4">
          <p className="text-[12px] font-medium text-foreground mb-2 lowercase">data tersimpan</p>
          {datasets.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">belum ada data. download dulu di atas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-1.5 font-normal">symbol</th>
                    <th className="text-left font-normal">interval</th>
                    <th className="text-right font-normal">bars</th>
                    <th className="text-left font-normal pl-4">dari</th>
                    <th className="text-left font-normal">sampai</th>
                    <th className="text-right font-normal">aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((d) => (
                    <tr key={`${d.symbol}-${d.interval}`} className="border-b border-border/50">
                      <td className="py-1.5 font-medium text-foreground">{d.symbol}</td>
                      <td>{d.interval}</td>
                      <td className="text-right tabular-nums">{d.bars.toLocaleString()}</td>
                      <td className="pl-4">{d.firstBar?.slice(0, 10) || "-"}</td>
                      <td>{d.lastBar?.slice(0, 10) || "-"}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => exportCsv(d)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => removeDataset(d)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default DataSourcePage;
