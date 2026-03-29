import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, X, FileText } from "lucide-react";
import TradeDetailDialog from "./TradeDetailDialog";

interface Trade {
  id: string;
  pnl_net: number;
  side: string;
  close_time: string;
  open_time: string;
  symbol: string;
  account_id?: string | null;
  qty?: number;
  playbook?: string | null;
  r_multiple?: number | null;
  notes?: string | null;
}

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  trades: Trade[];
  onNoteClick?: () => void;
}

const DayDetailDialog = ({ open, onOpenChange, date, trades }: DayDetailDialogProps) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const dayTrades = useMemo(() => {
    return trades
      .filter((t) => t.close_time.slice(0, 10) === date)
      .sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime());
  }, [trades, date]);

  const stats = useMemo(() => {
    const winners = dayTrades.filter((t) => t.pnl_net > 0).length;
    const losers = dayTrades.filter((t) => t.pnl_net < 0).length;
    const totalPnl = dayTrades.reduce((s, t) => s + t.pnl_net, 0);
    const winRate = dayTrades.length > 0 ? Math.round((winners / dayTrades.length) * 100) : 0;
    return { total: dayTrades.length, winners, losers, totalPnl, winRate };
  }, [dayTrades]);

  const fmtDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const fmtPnl = (n: number) => `${n >= 0 ? "+" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const fmtTime = (t: string) => {
    const dt = new Date(t);
    return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto p-0 gap-0 bg-card border-border">
          <DialogHeader className="p-5 pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-[15px] font-bold text-foreground">
                  {fmtDate(date)}
                </DialogTitle>
                <span className={`text-[13px] font-bold ${stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Net P&L {fmtPnl(stats.totalPnl)}
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Trades", value: stats.total, color: "text-foreground" },
                { label: "Winners", value: stats.winners, color: "text-green-400" },
                { label: "Losers", value: stats.losers, color: "text-red-400" },
                { label: "Win Rate", value: `${stats.winRate}%`, color: "text-foreground" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Trade table */}
            {dayTrades.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      {["Time", "Symbol", "Side", "Qty", "Net P&L", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayTrades.map((t) => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 text-foreground">{fmtTime(t.close_time)}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{t.symbol}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.side === "BUY" || t.side === "LONG"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {t.side === "BUY" ? "LONG" : t.side === "SELL" ? "SHORT" : t.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-foreground">{t.qty || 1}</td>
                        <td className={`px-4 py-3 font-bold ${t.pnl_net >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {fmtPnl(t.pnl_net)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{t.playbook || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.r_multiple?.toFixed(1) || "-"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedTrade(t)}
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dayTrades.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">No trades on this day.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedTrade && (
        <TradeDetailDialog
          open={!!selectedTrade}
          onOpenChange={(o) => !o && setSelectedTrade(null)}
          trade={selectedTrade}
        />
      )}
    </>
  );
};

export default DayDetailDialog;
