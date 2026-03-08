import { HelpCircle, PlayCircle, Plus, Filter, TrendingUp } from "lucide-react";

const bookmarks = [
  "gap fill by size",
  "IB: init... by rejection",
  "inside bars",
  "IB: initial balance breakout",
  "IB: initial ... by levels",
  "outside days",
  "opening range indicator",
];

const stockWatchlist = ["QQQ", "TSLA", "NVDA", "SPY", "BULL", "GLD", "HIMS"];
const futuresWatchlist = ["MNQ", "MGC", "MYM", "MES"];

const typeConfig: Record<string, { label: string; color: string }> = {
  ib: { label: "IB", color: "bg-primary/15 text-primary border-primary/30" },
  momentum: { label: "Mom", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  occ: { label: "OCC", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  gapfill: { label: "Gap", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const RightSidebar = () => {
  return (
    <div className="h-full border-l border-border bg-surface w-[240px] shrink-0 overflow-y-auto">
      <div className="p-4 space-y-5">

        {/* Help */}
        <div className="space-y-2">
          <p className="section-label">help</p>
          <button className="w-full flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1">
            <HelpCircle className="h-4 w-4 shrink-0" />
            how to use the reports
          </button>
          <button className="w-full flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1">
            <PlayCircle className="h-4 w-4 shrink-0" />
            quick explainer video
          </button>
        </div>

        {/* Custom Templates */}
        <div className="space-y-2">
          <p className="section-label">custom templates</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium">
              this report
            </button>
            <button className="px-3 py-1 rounded-lg bg-secondary text-secondary-foreground text-[11px]">
              all templates
            </button>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-foreground py-1">
            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
            IB By Rejection Template
          </div>
        </div>


        {/* Bookmarks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="section-label">bookmarks</p>
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">price action</p>
          <div className="space-y-1">
            {bookmarks.map((b) => (
              <div key={b} className="flex items-center gap-2 text-[12px] text-foreground/70 py-0.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-primary/60 shrink-0" />
                {b}
              </div>
            ))}
          </div>
        </div>

        {/* Watchlist */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="section-label">watchlist</p>
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">stock</p>
          <div className="space-y-0.5">
            {stockWatchlist.map((t) => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-foreground/70 py-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-profit shrink-0" />
                {t}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground font-medium mt-2">futures</p>
          <div className="space-y-0.5">
            {futuresWatchlist.map((t) => (
              <div key={t} className="flex items-center gap-2 text-[12px] text-foreground/70 py-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-profit shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
