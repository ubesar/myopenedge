import { useMemo } from "react";
import { computeQuantMetrics, DEFAULT_QUANT_SETTINGS, type QuantSettings, type QuantTrade } from "@/lib/quant-metrics";

interface QuantPanelProps {
  trades: QuantTrade[];
  settings?: QuantSettings;
  label?: string;
}

const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "∞");
const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "muted" }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono font-medium ${
      tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-red-500" : tone === "muted" ? "text-muted-foreground" : "text-foreground"
    }`}>{value}</span>
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <h5 className="text-[11px] text-muted-foreground mb-2.5 uppercase tracking-wider">{title}</h5>
    <div className="space-y-1.5 text-[11px]">{children}</div>
  </div>
);

const QuantPanel = ({ trades, settings = DEFAULT_QUANT_SETTINGS, label }: QuantPanelProps) => {
  const m = useMemo(() => computeQuantMetrics(trades, settings), [trades, settings]);

  if (m.n === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-[11px] text-muted-foreground">
        quant panel — no resolved trades to evaluate.
      </div>
    );
  }

  const maxAbs = Math.max(0.01, ...m.buckets.map((b) => Math.abs(b.netEvR)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-[13px] font-semibold text-foreground lowercase">quant panel{label ? ` — ${label}` : ""}</h4>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
          m.netEvR > 0 && m.edgeProven
            ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
            : m.netEvR > 0
            ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
            : "border-red-500/40 text-red-500 bg-red-500/10"
        }`}>
          {m.netEvR > 0 && m.edgeProven ? "edge proven (net +EV)" : m.netEvR > 0 ? "positive EV — not statistically proven" : "negative EV after cost"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* 1. EV after cost */}
        <Card title="ev setelah cost">
          <Stat label="gross expectancy" value={`${fmt(m.grossEvR)} R`} tone={m.grossEvR > 0 ? "pos" : "neg"} />
          <Stat label="cost per trade" value={`${fmt(m.costR, 3)} R · ${money(m.costDollar)}`} tone="muted" />
          <Stat label="net expectancy" value={`${fmt(m.netEvR)} R · ${money(m.netEvDollar)}`} tone={m.netEvR > 0 ? "pos" : "neg"} />
          <Stat label="net per day" value={money(m.netEvDollarPerDay)} tone={m.netEvDollarPerDay > 0 ? "pos" : "neg"} />
          <Stat label="total net p&l" value={money(m.totalNetDollar)} tone={m.totalNetDollar > 0 ? "pos" : "neg"} />
          <Stat label="profit factor (net)" value={fmt(m.profitFactorNet)} />
          <Stat label="breakeven win rate" value={`${fmt(m.breakevenWinRate, 1)}%`} tone="muted" />
          <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
            risk {money(m.riskDollar)}/trade · payoff {fmt(m.payoff)}:1
          </p>
        </Card>

        {/* 2. Sample & confidence */}
        <Card title="sample & confidence">
          <Stat label="trades (resolved)" value={String(m.n)} />
          <Stat label="wins / losses" value={`${m.wins} / ${m.losses}`} />
          <Stat label="unresolved" value={String(m.open)} tone="muted" />
          <Stat label="win rate" value={`${fmt(m.winRate, 1)}%`} />
          <Stat label="95% CI (wilson)" value={`${fmt(m.ciLow, 1)}% – ${fmt(m.ciHigh, 1)}%`} tone="muted" />
          <Stat label="trading days" value={String(m.tradingDays)} tone="muted" />
          <div className="pt-1 space-y-1">
            {m.smallSample && (
              <p className="text-[10px] text-amber-500">⚠ sample terlalu kecil (n &lt; 30) untuk disimpulkan.</p>
            )}
            {!m.edgeProven && (
              <p className="text-[10px] text-amber-500">
                ⚠ batas bawah CI ({fmt(m.ciLow, 1)}%) di bawah breakeven ({fmt(m.breakevenWinRate, 1)}%) — edge belum terbukti positif.
              </p>
            )}
            {m.edgeProven && !m.smallSample && (
              <p className="text-[10px] text-emerald-500">✓ batas bawah CI di atas breakeven win rate.</p>
            )}
          </div>
        </Card>

        {/* 3. Kelly sizing */}
        <Card title="sizing (fractional kelly)">
          {m.noEdge ? (
            <p className="text-[11px] text-red-500 font-medium">no edge — jangan sizing</p>
          ) : (
            <>
              <Stat label="full kelly" value={`${fmt(m.kellyFull * 100, 1)}%`} />
              <Stat label="half kelly" value={`${fmt(m.kellyHalf * 100, 1)}%`} />
              <Stat label="quarter kelly (rekomendasi)" value={`${fmt(m.kellyQuarter * 100, 1)}%`} tone="pos" />
              <Stat label="risk $ / trade @ ¼ kelly" value={money(m.kellyRiskDollar)} />
            </>
          )}
          <Stat label="avg win / avg loss" value={`${fmt(m.avgWinR)}R / ${fmt(m.avgLossR)}R`} tone="muted" />
          <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
            f = W − (1−W)/R, memakai payoff bersih setelah cost. akun {money(settings.accountSize)} · risk {settings.riskPct}%/trade.
          </p>
        </Card>

        {/* 4. Edge decay */}
        <Card title="edge decay">
          <Stat label={m.inSample.label} value={`${fmt(m.inSample.winRate, 1)}% · ${fmt(m.inSample.netEvR)}R (n=${m.inSample.n})`} />
          <Stat label={m.outSample.label} value={`${fmt(m.outSample.winRate, 1)}% · ${fmt(m.outSample.netEvR)}R (n=${m.outSample.n})`} />
          <Stat
            label="delta net ev"
            value={`${m.outSample.netEvR - m.inSample.netEvR >= 0 ? "+" : ""}${fmt(m.outSample.netEvR - m.inSample.netEvR)} R`}
            tone={m.outSample.netEvR - m.inSample.netEvR >= 0 ? "pos" : "neg"}
          />
          <Stat
            label="status"
            value={m.decayStatus}
            tone={m.decayStatus === "decaying" ? "neg" : m.decayStatus === "insufficient" ? "muted" : "pos"}
          />
          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground mb-1">rolling net ev (R)</p>
            <div className="flex items-end gap-1 h-[54px]">
              {m.buckets.map((b) => {
                const h = (Math.abs(b.netEvR) / maxAbs) * 24;
                return (
                  <div key={b.label} className="flex-1 flex flex-col items-center justify-center h-full" title={`${b.label}: ${fmt(b.netEvR)}R (n=${b.n})`}>
                    <div className="flex-1 flex flex-col justify-end w-full">
                      {b.netEvR >= 0 && <div className="w-full bg-emerald-500/80 rounded-t" style={{ height: `${h}px` }} />}
                    </div>
                    <div className="w-full border-t border-border" />
                    <div className="flex-1 w-full">
                      {b.netEvR < 0 && <div className="w-full bg-red-500/80 rounded-b" style={{ height: `${h}px` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">{m.buckets.length} bucket · hover untuk detail</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default QuantPanel;
