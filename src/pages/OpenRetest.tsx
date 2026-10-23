import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Play, Crosshair } from "lucide-react";
import { toast } from "sonner";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { analyzeOpenRetest, type OHLCBar, type OpenRetestResult } from "@/lib/open-retest-analysis";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBars(symbol: string, interval: "1min" | "5min", batches: number): Promise<OHLCBar[]> {
  let all: any[] = [];
  let end: string | null = null;
  for (let i = 0; i < batches; i++) {
    const body: Record<string, any> = { symbol, interval, outputsize: "5000" };
    if (end) body.end_date = end;
    const { data, error } = await supabase.functions.invoke("twelvedata-proxy", { body });
    if (error) throw new Error("gagal mengambil data");
    if (data?.status === "error") throw new Error(data.message || "api error");
    const v = data?.values;
    if (!v?.length) break;
    all = all.concat(v);
    end = v[v.length - 1].datetime;
    if (i < batches - 1) await sleep(8500);
  }
  const seen = new Set<string>();
  return all
    .filter((v) => (seen.has(v.datetime) ? false : (seen.add(v.datetime), true)))
    .map((v) => ({ datetime: v.datetime, open: +v.open, high: +v.high, low: +v.low, close: +v.close }));
}

export default function OpenRetest() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [symbol, setSymbol] = useState("QQQ");
  const [tf, setTf] = useState<"1min" | "5min">("5min");
  const [batches, setBatches] = useState("1");
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("11:00");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<OpenRetestResult | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const bars = await fetchBars(symbol.toUpperCase(), tf, Math.max(1, Math.min(6, +batches || 1)));
      const r = analyzeOpenRetest(bars, start, end);
      if (!r.days.length) toast.error("tidak ada hari dengan candle tepat di jam mulai");
      setRes(r);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const days = useMemo(() => (res ? [...res.days].reverse() : []), [res]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppNavSidebar
        collapsed={isMobile ? !mobileOpen : collapsed}
        onToggle={() => (isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed))}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && <MobileHeader onMenuToggle={() => setMobileOpen(!mobileOpen)} title="open retest" />}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 max-w-[1400px] w-full mx-auto">
          <div>
            <h1 className="text-2xl font-bold lowercase flex items-center gap-2">
              <Crosshair className="h-6 w-6 text-primary" /> ny open retest
            </h1>
            <p className="text-sm text-muted-foreground lowercase">
              berapa kali harga kembali menyentuh / menyeberangi harga open 09:30 ny sampai jam akhir.
            </p>
          </div>

          <Card className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div><Label className="lowercase">symbol</Label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
            <div>
              <Label className="lowercase">timeframe</Label>
              <Select value={tf} onValueChange={(v) => setTf(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1min">m1</SelectItem><SelectItem value="5min">m5</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="lowercase">batch (×5000 bar)</Label>
              <Input type="number" min={1} max={6} value={batches} onChange={(e) => setBatches(e.target.value)} />
            </div>
            <div><Label className="lowercase">mulai (ny)</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label className="lowercase">akhir (ny)</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <Button onClick={run} disabled={loading} className="lowercase">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} run
            </Button>
            <p className="col-span-full text-xs text-muted-foreground lowercase">
              m1: 1 batch ≈ 12 hari · m5: 1 batch ≈ 60 hari. touch = range candle menyentuh open; cross = close pindah sisi open.
            </p>
          </Card>

          {res && res.days.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["hari dianalisa", res.days.length],
                  ["rata-rata touch", res.avgTouches.toFixed(1)],
                  ["rata-rata cross", res.avgCrosses.toFixed(1)],
                  ["0 touch (trend)", res.zeroTouchPct.toFixed(0) + "%"],
                ].map(([l, v]) => (
                  <Card key={l} className="p-3">
                    <p className="text-xs text-muted-foreground lowercase">{l}</p>
                    <p className="text-xl font-bold">{v}</p>
                  </Card>
                ))}
              </div>

              <Card className="p-4">
                <h2 className="text-sm font-semibold lowercase mb-2">distribusi (% hari)</h2>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={res.buckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                      <YAxis unit="%" stroke="hsl(var(--muted-foreground))" />
                      <Tooltip formatter={(v: number) => v.toFixed(1) + "%"} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar dataKey="touches" name="touch" fill="hsl(var(--primary))" />
                      <Bar dataKey="crosses" name="cross" fill="hsl(var(--muted-foreground))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 overflow-x-auto">
                <h2 className="text-sm font-semibold lowercase mb-2">per hari</h2>
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground lowercase text-xs">
                    <tr className="text-left">
                      <th className="py-1">tanggal</th><th>open</th><th>touch</th><th>cross</th>
                      <th>max naik</th><th>max turun</th><th>touch terakhir</th><th>close akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.date} className="border-t border-border">
                        <td className="py-1">{d.date}</td>
                        <td>{d.openPrice.toFixed(2)}</td>
                        <td className="font-semibold">{d.touches}</td>
                        <td>{d.crosses}</td>
                        <td>{d.maxUpPct.toFixed(2)}%</td>
                        <td>{d.maxDownPct.toFixed(2)}%</td>
                        <td>{d.lastTouchTime ?? "-"}</td>
                        <td>{d.closeAtEnd.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
