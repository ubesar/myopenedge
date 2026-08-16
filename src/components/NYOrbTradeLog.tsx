import { useMemo, useState } from "react";
import { aggregateToM15, type CandleBar } from "@/lib/m15-aggregation";
import { FIXED_RISK_USD, type NYOrbDay } from "@/lib/ny-orb-m15";

interface Props {
  days: NYOrbDay[];
  symbol: string;
}

const W = 900;
const H = 340;
const PAD_L = 8;
const PAD_R = 66;
const PAD_Y = 16;

const TradeChart = ({ day }: { day: NYOrbDay }) => {
  const bars: CandleBar[] = useMemo(() => aggregateToM15(day.bars), [day]);
  const t = day.trade;
  if (bars.length === 0) return null;

  const c1i = t ? bars.findIndex((b) => b.time === t.c1Time) : -1;
  const c2i = t ? bars.findIndex((b) => b.time === t.c2Time) : -1;
  const exitI = t?.exitTime ? bars.findIndex((b) => b.time === t.exitTime) : -1;

  const levels: { v: number; label: string; color: string; dash?: string }[] = [];
  if (t) {
    const range = Math.abs(t.entry - (t.side === "long" ? bars[c1i]?.low ?? t.entry : bars[c1i]?.high ?? t.entry));
    levels.push({ v: t.entry, label: `entry / fib 1 (${t.entry.toFixed(2)})`, color: "hsl(var(--primary))" });
    levels.push({ v: t.target, label: `tp 1.5 (${t.target.toFixed(2)})`, color: "hsl(142 71% 45%)" });
    levels.push({ v: t.stop, label: `sl (${t.stop.toFixed(2)})`, color: "hsl(var(--destructive))" });
    if (range > 0) {
      const fib0 = t.side === "long" ? t.entry - range : t.entry + range;
      const fib05 = (fib0 + t.entry) / 2;
      levels.push({ v: fib05, label: `0.5 (${fib05.toFixed(2)})`, color: "hsl(0 0% 55%)", dash: "3 3" });
      levels.push({ v: fib0, label: `0 (${fib0.toFixed(2)})`, color: "hsl(0 0% 40%)", dash: "3 3" });
    }
  }

  const lows = [...bars.map((b) => b.low), ...levels.map((l) => l.v)];
  const highs = [...bars.map((b) => b.high), ...levels.map((l) => l.v)];
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const pad = (max - min) * 0.06 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const y = (p: number) => PAD_Y + ((hi - p) / (hi - lo)) * (H - PAD_Y * 2);
  const slot = (W - PAD_L - PAD_R) / bars.length;
  const x = (i: number) => PAD_L + slot * (i + 0.5);
  const bw = Math.max(2, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[340px]">
      {levels.map((l) => (
        <g key={l.label}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(l.v)}
            y2={y(l.v)}
            stroke={l.color}
            strokeWidth={1}
            strokeDasharray={l.dash}
          />
          <text x={W - PAD_R + 4} y={y(l.v) + 3} fontSize={9} fill={l.color}>
            {l.label}
          </text>
        </g>
      ))}

      {bars.map((b, i) => {
        const up = b.close >= b.open;
        const isC1 = i === c1i;
        const isC2 = i === c2i;
        const color = isC1
          ? up
            ? "hsl(84 100% 55%)"
            : "hsl(300 100% 60%)"
          : up
            ? "hsl(142 60% 45%)"
            : "hsl(0 70% 50%)";
        const yo = y(b.open);
        const yc = y(b.close);
        return (
          <g key={b.time} opacity={isC1 || isC2 ? 1 : 0.75}>
            <line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth={1} />
            <rect
              x={x(i) - bw / 2}
              y={Math.min(yo, yc)}
              width={bw}
              height={Math.max(1, Math.abs(yc - yo))}
              fill={color}
              stroke={isC2 ? "hsl(var(--foreground))" : "none"}
              strokeWidth={isC2 ? 1 : 0}
            />
            {(isC1 || isC2 || i === exitI) && (
              <text x={x(i)} y={H - 3} fontSize={8} fill="hsl(var(--muted-foreground))" textAnchor="middle">
                {isC1 ? "c1" : isC2 ? "c2" : "exit"}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const NYOrbTradeLog = ({ days, symbol }: Props) => {
  const logs = useMemo(() => days.filter((d) => !!d.trade).reverse(), [days]);
  const [active, setActive] = useState(0);
  if (logs.length === 0) return null;

  const day = logs[Math.min(active, logs.length - 1)];
  const t = day.trade!;

  const badge =
    t.outcome === "win"
      ? "bg-emerald-500/15 text-emerald-500"
      : t.outcome === "loss"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <p className="text-[12px] font-medium text-foreground">trade log &amp; chart per entry</p>
        <p className="text-[11px] text-muted-foreground">{symbol.toUpperCase()} · {logs.length} setups</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <div className="border-b lg:border-b-0 lg:border-r border-border max-h-[420px] overflow-y-auto">
          {logs.map((d, i) => {
            const tr = d.trade!;
            return (
              <button
                key={d.date}
                onClick={() => setActive(i)}
                className={`w-full text-left px-3 py-2 border-b border-border/60 ${
                  i === active ? "bg-primary/10" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-foreground">{d.date}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      tr.outcome === "win"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : tr.outcome === "loss"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tr.outcome}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {tr.side} · c1 {tr.c1Time} · {tr.risk ? `${(tr.pnlUsd).toFixed(0)} usd` : "no fill"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="p-3">
          <div className="flex flex-wrap gap-3 mb-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded font-medium ${badge}`}>{t.outcome}</span>
            <span className="text-muted-foreground">side: <span className="text-foreground">{t.side}</span></span>
            <span className="text-muted-foreground">entry: <span className="text-foreground font-mono">{t.entry.toFixed(2)}</span></span>
            <span className="text-muted-foreground">sl: <span className="text-foreground font-mono">{t.stop.toFixed(2)}</span></span>
            <span className="text-muted-foreground">tp: <span className="text-foreground font-mono">{t.target.toFixed(2)}</span></span>
            <span className="text-muted-foreground">rr: <span className="text-foreground font-mono">{t.risk ? (Math.abs(t.target - t.entry) / t.risk).toFixed(2) : "—"}</span></span>
            <span className="text-muted-foreground">p&amp;l: <span className="text-foreground font-mono">${t.pnlUsd.toFixed(0)}</span> (risk ${FIXED_RISK_USD})</span>
          </div>
          <TradeChart day={day} />
        </div>
      </div>
    </div>
  );
};

export default NYOrbTradeLog;
