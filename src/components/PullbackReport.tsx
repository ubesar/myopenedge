import type { PullbackResult, PullbackSideStats } from "@/lib/pullback-analysis";

interface Props {
  result: PullbackResult;
  symbol: string;
  dateRange: string;
  bodyThresholdPct?: number; // e.g. 70
}

const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
const fmtR = (n: number) => `${n >= 0 ? "" : ""}${n.toFixed(2)}R`;

function expectancy(side: PullbackSideStats, rr: number) {
  const resolved = side.wins + side.losses;
  if (resolved === 0) return 0;
  const wr = side.wins / resolved;
  const lr = side.losses / resolved;
  return wr * rr - lr * 1;
}

function StackedBar({ side, label }: { side: PullbackSideStats; label: string }) {
  const resolved = side.wins + side.losses;
  const winPct = resolved > 0 ? (side.wins / resolved) * 100 : 0;
  const lossPct = resolved > 0 ? (side.losses / resolved) * 100 : 0;

  return (
    <div className="flex flex-col items-center flex-1">
      <div className="relative w-full max-w-[140px] h-[260px] flex flex-col">
        {/* loss (top) */}
        <div
          className="w-full bg-muted/60 flex items-center justify-center text-[11px] text-foreground/90 font-medium"
          style={{ height: `${lossPct}%`, minHeight: lossPct > 0 ? 24 : 0 }}
        >
          {lossPct > 8 && <span>{fmtPct(lossPct)} loss</span>}
        </div>
        {/* win (bottom) */}
        <div
          className="w-full bg-primary flex items-center justify-center text-[11px] text-primary-foreground font-medium"
          style={{ height: `${winPct}%`, minHeight: winPct > 0 ? 24 : 0 }}
        >
          {winPct > 8 && <span>{fmtPct(winPct)} win</span>}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 lowercase">
        {label} · {side.total} trades
      </p>
    </div>
  );
}

function TPCard({
  title,
  subtitle,
  metaLine,
  bullish,
  bearish,
  overall,
}: {
  title: string;
  subtitle: string;
  metaLine: string;
  bullish: PullbackSideStats;
  bearish: PullbackSideStats;
  overall: PullbackSideStats;
}) {
  const yTicks = [100, 75, 50, 25, 0];

  return (
    <div className="rounded-xl border border-border bg-card p-5 lg:p-6">
      {/* header */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="text-[14px] font-semibold text-foreground lowercase">{title}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">win rate</p>
          <p className="text-[22px] font-semibold text-foreground tabular-nums leading-tight">
            {fmtPct(overall.winRate)}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground lowercase mb-0.5">{subtitle}</p>
      <p className="text-[11px] text-muted-foreground lowercase mb-5">{metaLine}</p>

      {/* chart */}
      <div className="flex items-stretch gap-3 h-[280px]">
        {/* y axis */}
        <div className="flex flex-col justify-between text-[10px] text-muted-foreground py-0 w-8 shrink-0">
          {yTicks.map((t) => (
            <span key={t} className="leading-none">{t}%</span>
          ))}
        </div>
        {/* bars area with gridlines */}
        <div className="relative flex-1">
          {/* gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {yTicks.map((t) => (
              <div key={t} className="border-t border-border/40 w-full h-0" />
            ))}
          </div>
          {/* bars */}
          <div className="relative h-full flex items-end justify-around gap-4 pt-1 pb-6">
            <StackedBar side={bullish} label="bullish" />
            <StackedBar side={bearish} label="bearish" />
          </div>
        </div>
      </div>

      {/* sub stats */}
      <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border/60">
        <div>
          <p className="text-[12px] text-foreground lowercase font-medium">bullish</p>
          <p className="text-[11px] text-muted-foreground lowercase">win rate {fmtPct(bullish.winRate)}</p>
        </div>
        <div>
          <p className="text-[12px] text-foreground lowercase font-medium">bearish</p>
          <p className="text-[11px] text-muted-foreground lowercase">win rate {fmtPct(bearish.winRate)}</p>
        </div>
      </div>

      {/* legend */}
      <div className="flex items-center justify-center gap-5 mt-4 text-[11px] text-muted-foreground lowercase">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> win</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/60" /> loss</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted/60 border border-border" /> open</span>
      </div>
    </div>
  );
}

function InsightCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-4">
      <p className="text-[11px] text-muted-foreground lowercase mb-2">{label}</p>
      <p className="text-[22px] font-semibold text-foreground tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground lowercase mt-2">{sub}</p>}
    </div>
  );
}

const PullbackReport = ({ result, symbol, dateRange, bodyThresholdPct }: Props) => {
  const sym = symbol.toUpperCase();
  const bodyPct = bodyThresholdPct ?? Math.round(result.params.bodyThreshold * 100);
  const pbPct = Math.round(result.params.pullbackLevel * 100);
  const endH = Math.floor(result.params.sessionEndMinutes / 60);
  const endM = String(result.params.sessionEndMinutes % 60).padStart(2, "0");

  const tp1Reward = Math.round(result.params.tp1Ratio * 100);
  const tp2RewardMul = Math.round(result.params.tp2Ratio / result.params.tp1Ratio);

  const tp1Sub = `${sym} · entry @ ${pbPct}% · sl ujung · reward = ${tp1Reward}% candle (= risk)`;
  const tp2Sub = `${sym} · entry @ ${pbPct}% · sl ujung · reward = ${Math.round(result.params.tp2Ratio * 100)}% candle (${tp2RewardMul}× risk)`;
  const meta = `m15 · body ≥ ${bodyPct}% · 09:30 – ${endH}:${endM} ny · ${dateRange}`;

  // expectancy (using overall side)
  const exp1 = expectancy(result.overall, 1); // RR 1:1
  const exp2 = expectancy(result.overall, result.params.tp2Ratio / result.params.tp1Ratio);

  const daysWithSignal = new Set(result.trades.map(t => t.date)).size;
  const dayPct = result.totalDays > 0 ? (daysWithSignal / result.totalDays) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TPCard
          title="tp 1 · rr 1:1"
          subtitle={tp1Sub}
          metaLine={meta}
          bullish={{ ...result.bullish.tp1 }}
          bearish={{ ...result.bearish.tp1 }}
          overall={result.overall.tp1}
        />
        <TPCard
          title="tp 2 · rr 1:2"
          subtitle={tp2Sub}
          metaLine={meta}
          bullish={{ ...result.bullish.tp2 }}
          bearish={{ ...result.bearish.tp2 }}
          overall={result.overall.tp2}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
          pullback 50% insight — {sym}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <InsightCell
            label="total trades"
            value={String(result.totalTrades)}
            sub={`across ${result.totalDays} days`}
          />
          <InsightCell
            label="tp1 · rr 1:1 · expectancy"
            value={fmtR(exp1)}
            sub={`wr ${fmtPct(result.overall.tp1.winRate)} · ${result.overall.tp1.wins}W/${result.overall.tp1.losses}L`}
          />
          <InsightCell
            label="tp2 · rr 1:2 · expectancy"
            value={fmtR(exp2)}
            sub={`wr ${fmtPct(result.overall.tp2.winRate)} · ${result.overall.tp2.wins}W/${result.overall.tp2.losses}L`}
          />
          <InsightCell
            label="days with signal"
            value={fmtPct(dayPct)}
            sub={`${daysWithSignal} of ${result.totalDays}`}
          />
        </div>
      </div>
    </div>
  );
};

export default PullbackReport;
