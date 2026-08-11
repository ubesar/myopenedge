import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { monteCarlo, summarize, type ExecConfig, type ExecTrade } from "@/lib/backtest-engine";

export interface ParamVariant {
  param: number;
  label: string;
  trades: ExecTrade[];
}

interface Props {
  trades: ExecTrade[];
  variants: ParamVariant[];
  cfg: ExecConfig;
  baseParam: number;
}

const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(0)}`;

const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <p className="text-[12px] font-medium text-foreground lowercase">{title}</p>
    {note && <p className="text-[10px] text-muted-foreground mb-2 lowercase">{note}</p>}
    <div className="mt-2">{children}</div>
  </div>
);

const StatRow = ({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) => (
  <div className="flex justify-between gap-3 text-[11px]">
    <span className="text-muted-foreground lowercase">{label}</span>
    <span className={`font-mono ${tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-destructive" : "text-foreground"}`}>{value}</span>
  </div>
);

const RobustnessPanel = ({ trades, variants, cfg, baseParam }: Props) => {
  const [splitPct, setSplitPct] = useState(60);
  const [mcSeed, setMcSeed] = useState(0);

  const { is, oos } = useMemo(() => {
    const idx = Math.floor((trades.length * splitPct) / 100);
    return { is: trades.slice(0, idx), oos: trades.slice(idx) };
  }, [trades, splitPct]);

  const mc = useMemo(() => monteCarlo(trades, cfg, 1000), [trades, cfg, mcSeed]);

  // walk-forward: 4 sequential folds, param picked on the previous fold (in-sample)
  const wf = useMemo(() => {
    if (!variants.length || trades.length < 12) return null;
    const dates = Array.from(new Set(trades.map((t) => t.date))).sort();
    const folds = 4;
    const size = Math.floor(dates.length / folds);
    if (size < 3) return null;
    const chunks = Array.from({ length: folds }, (_, i) =>
      dates.slice(i * size, i === folds - 1 ? dates.length : (i + 1) * size),
    );
    const oosTrades: ExecTrade[] = [];
    const log: { fold: string; param: number; isNet: number; oosNet: number; n: number }[] = [];
    for (let f = 1; f < folds; f++) {
      const isSet = new Set(chunks[f - 1]);
      const oosSet = new Set(chunks[f]);
      let best = variants[0];
      let bestNet = -Infinity;
      for (const v of variants) {
        const net = summarize(v.trades.filter((t) => isSet.has(t.date))).net;
        if (net > bestNet) { bestNet = net; best = v; }
      }
      const picked = best.trades.filter((t) => oosSet.has(t.date));
      oosTrades.push(...picked);
      log.push({ fold: `fold ${f}`, param: best.param, isNet: bestNet, oosNet: summarize(picked).net, n: picked.length });
    }
    let eq = 0;
    const curve = oosTrades.map((t, i) => ({ i: i + 1, equity: (eq += t.netPnl) }));
    return { log, curve, summary: summarize(oosTrades) };
  }, [variants, trades]);

  const isS = summarize(is);
  const oosS = summarize(oos);

  return (
    <div className="space-y-3">
      <h4 className="text-[13px] font-semibold text-foreground lowercase">robustness validation</h4>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="out-of-sample testing" note={`split ${splitPct}% in-sample / ${100 - splitPct}% out-of-sample (chronological)`}>
          <div className="flex gap-1.5 mb-3">
            {[50, 60, 70, 80].map((p) => (
              <Button key={p} size="sm" variant={p === splitPct ? "default" : "outline"} className="h-6 text-[10px]" onClick={() => setSplitPct(p)}>
                {p}/{100 - p}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">in-sample</p>
              <StatRow label="trades" value={String(isS.n)} />
              <StatRow label="net pnl" value={money(isS.net)} tone={isS.net >= 0 ? "pos" : "neg"} />
              <StatRow label="win rate" value={`${isS.winRate.toFixed(1)}%`} />
              <StatRow label="max dd" value={money(-isS.maxDd)} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">out-of-sample</p>
              <StatRow label="trades" value={String(oosS.n)} />
              <StatRow label="net pnl" value={money(oosS.net)} tone={oosS.net >= 0 ? "pos" : "neg"} />
              <StatRow label="win rate" value={`${oosS.winRate.toFixed(1)}%`} />
              <StatRow label="max dd" value={money(-oosS.maxDd)} />
            </div>
          </div>
        </Section>

        <Section title="walk-forward analysis" note="param dipilih di window in-sample, divalidasi di window berikutnya, hasil oos digabung">
          {!wf ? (
            <p className="text-[11px] text-muted-foreground lowercase">butuh lebih banyak data untuk walk-forward.</p>
          ) : (
            <>
              <div className="h-[120px] mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={wf.curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="i" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={52} tickFormatter={(v) => money(v)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                    <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full text-[10px]">
                <thead className="text-muted-foreground">
                  <tr>{["fold", "param", "is net", "oos net", "n"].map((h) => <th key={h} className="text-left font-normal lowercase py-0.5">{h}</th>)}</tr>
                </thead>
                <tbody className="font-mono">
                  {wf.log.map((r) => (
                    <tr key={r.fold} className="border-t border-border/50">
                      <td className="py-0.5">{r.fold}</td>
                      <td>{r.param}</td>
                      <td className={r.isNet >= 0 ? "text-emerald-500" : "text-destructive"}>{money(r.isNet)}</td>
                      <td className={r.oosNet >= 0 ? "text-emerald-500" : "text-destructive"}>{money(r.oosNet)}</td>
                      <td>{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-1.5 lowercase">
                total oos: {money(wf.summary.net)} · {wf.summary.n} trades · win {wf.summary.winRate.toFixed(1)}%
              </p>
            </>
          )}
        </Section>

        <Section title="monte carlo simulation" note="1000 reshuffle urutan trade — distribusi net profit &amp; max drawdown">
          {!mc ? (
            <p className="text-[11px] text-muted-foreground lowercase">butuh minimal 5 trade.</p>
          ) : (
            <>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mc.histogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={28} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">net profit</p>
                  <StatRow label="p5" value={money(mc.netP5)} tone={mc.netP5 >= 0 ? "pos" : "neg"} />
                  <StatRow label="p50" value={money(mc.netP50)} />
                  <StatRow label="p95" value={money(mc.netP95)} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">max drawdown</p>
                  <StatRow label="p5" value={money(-mc.ddP5)} />
                  <StatRow label="p50" value={money(-mc.ddP50)} />
                  <StatRow label="p95" value={money(-mc.ddP95)} tone="neg" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-muted-foreground lowercase">risk of ruin (dd ≥ 50% akun): {mc.ruinPct.toFixed(1)}%</p>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setMcSeed(mcSeed + 1)}>resimulate</Button>
              </div>
            </>
          )}
        </Section>

        <Section title="parameter sensitivity" note={`body ratio momentum candle digeser ±10–20% dari baseline ${baseParam}`}>
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground">
              <tr>{["param", "trades", "win %", "net pnl", "max dd"].map((h) => <th key={h} className="text-left font-normal lowercase py-1">{h}</th>)}</tr>
            </thead>
            <tbody className="font-mono">
              {variants.map((v) => {
                const s = summarize(v.trades);
                const base = v.param === baseParam;
                const heat = s.net >= 0 ? "bg-emerald-500/10" : "bg-destructive/10";
                return (
                  <tr key={v.param} className={`border-t border-border/50 ${heat} ${base ? "font-semibold" : ""}`}>
                    <td className="py-1">{v.label}{base ? " ★" : ""}</td>
                    <td>{s.n}</td>
                    <td>{s.winRate.toFixed(1)}</td>
                    <td className={s.net >= 0 ? "text-emerald-500" : "text-destructive"}>{money(s.net)}</td>
                    <td className="text-destructive">{money(-s.maxDd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
};

export default RobustnessPanel;
