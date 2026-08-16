import type { TpStats } from "@/lib/momentum-analysis";

interface Props {
  title: string;
  subtitle?: string;
  stats: TpStats;
}

const CHART_HEIGHT = 220;

const Bar = ({ winPct, lossPct, openPct, total }: { winPct: number; lossPct: number; openPct: number; total: number }) => {
  const winH = (winPct / 100) * CHART_HEIGHT;
  const lossH = (lossPct / 100) * CHART_HEIGHT;
  const openH = (openPct / 100) * CHART_HEIGHT;
  return (
    <div className="w-full flex flex-col rounded-t-md overflow-hidden">
      {openPct > 0 && (
        <div
          className="w-full bg-muted flex items-center justify-center text-[10px] sm:text-[12px] font-semibold text-muted-foreground transition-all duration-500"
          style={{ height: `${openH}px` }}
        >
          {openH >= 22 && `${openPct.toFixed(1)}% open`}
        </div>
      )}
      {lossPct > 0 && (
        <div
          className="w-full bg-chart-bar-b flex items-center justify-center text-[10px] sm:text-[12px] font-semibold text-primary-foreground transition-all duration-500"
          style={{ height: `${lossH}px` }}
        >
          {lossH >= 22 && `${lossPct.toFixed(1)}% loss`}
        </div>
      )}
      {winPct > 0 && (
        <div
          className="w-full bg-chart-bar-a flex items-center justify-center text-[10px] sm:text-[12px] font-semibold text-primary-foreground transition-all duration-500"
          style={{ height: `${winH}px` }}
        >
          {winH >= 22 && `${winPct.toFixed(1)}% win`}
        </div>
      )}
      <span className="text-[10px] text-muted-foreground text-center mt-1">{total} trades</span>
    </div>
  );
};

const split = (total: number, wins: number, losses: number) => {
  if (total === 0) return { winPct: 0, lossPct: 0, openPct: 0 };
  const open = total - wins - losses;
  return {
    winPct: (wins / total) * 100,
    lossPct: (losses / total) * 100,
    openPct: (open / total) * 100,
  };
};

const MomentumResultCard = ({ title, subtitle, stats }: Props) => {
  const yLabels = ["100%", "75%", "50%", "25%", "0%"];
  const bull = split(stats.bullish.total, stats.bullish.wins, stats.bullish.losses);
  const bear = split(stats.bearish.total, stats.bearish.wins, stats.bearish.losses);

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border flex items-center justify-between">
        <div>
          <h4 className="text-[12px] font-semibold text-foreground lowercase">{title}</h4>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">win rate</p>
          <p className="text-[16px] font-semibold text-foreground">{stats.winRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="px-4 py-5">
        <div className="flex items-end gap-0">
          <div className="flex flex-col justify-between pr-2 text-[10px] text-muted-foreground pb-5" style={{ height: `${CHART_HEIGHT}px` }}>
            {yLabels.map((l) => <span key={l}>{l}</span>)}
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ height: `${CHART_HEIGHT}px` }}>
              {yLabels.map((_, i) => <div key={i} className="border-b border-border/40" />)}
            </div>
            <div className="relative flex items-end justify-center gap-6 sm:gap-10" style={{ height: `${CHART_HEIGHT}px` }}>
              <div className="flex flex-col items-center w-[100px] sm:w-[130px]">
                <Bar {...bull} total={stats.bullish.total} />
              </div>
              <div className="flex flex-col items-center w-[100px] sm:w-[130px]">
                <Bar {...bear} total={stats.bearish.total} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-center gap-6 sm:gap-10 ml-8 mt-2">
          <span className="text-[10px] sm:text-[11px] text-muted-foreground text-center w-[100px] sm:w-[130px]">
            bullish
            <span className="block text-[9px] text-muted-foreground/70">win rate {stats.bullish.winRate.toFixed(1)}%</span>
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground text-center w-[100px] sm:w-[130px]">
            bearish
            <span className="block text-[9px] text-muted-foreground/70">win rate {stats.bearish.winRate.toFixed(1)}%</span>
          </span>
        </div>

        <div className="flex items-center justify-center gap-5 mt-3 text-[10px]">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-chart-bar-a" /><span className="text-muted-foreground">win</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-chart-bar-b" /><span className="text-muted-foreground">loss</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted" /><span className="text-muted-foreground">open</span></div>
        </div>
      </div>
    </div>
  );
};

export default MomentumResultCard;
