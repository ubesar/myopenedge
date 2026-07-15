import { useMemo, useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TradeDetailDialog from "./TradeDetailDialog";
import { resolveTradeScreenshotUrl } from "@/lib/trade-screenshot-url";

interface Trade {
  id: string;
  pnl_gross: number;
  pnl_net: number;
  fees: number | null;
  side: string;
  close_time: string;
  open_time: string;
  symbol: string;
  account_id?: string | null;
  qty?: number;
  notes?: string | null;
}

const netPnl = (t: Trade) => t.pnl_gross - (t.fees || 0);

interface Attachment {
  id: string;
  file_url: string;
  file_name: string | null;
  trade_id: string | null;
  preview_url: string;
}

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  trades: Trade[];
}

const DayDetailDialog = ({ open, onOpenChange, date, trades }: DayDetailDialogProps) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [attachmentMap, setAttachmentMap] = useState<Record<string, Attachment[]>>({});

  const dayTrades = useMemo(() => {
    return trades
      .filter((t) => t.close_time.slice(0, 10) === date)
      .sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime());
  }, [trades, date]);

  const loadDayAttachments = useCallback(async () => {
    if (dayTrades.length === 0) {
      setAttachmentMap({});
      return;
    }

    const ids = dayTrades.map((t) => t.id);
    const { data, error } = await supabase
      .from("attachments")
      .select("id, file_url, file_name, trade_id")
      .in("trade_id", ids);

    if (error) {
      setAttachmentMap({});
      return;
    }

    const resolved = await Promise.all(
      ((data as Omit<Attachment, "preview_url">[]) || []).map(async (a) => ({
        ...a,
        preview_url: await resolveTradeScreenshotUrl(a.file_url),
      }))
    );

    const map: Record<string, Attachment[]> = {};
    resolved.forEach((a) => {
      if (!a.trade_id) return;
      if (!map[a.trade_id]) map[a.trade_id] = [];
      map[a.trade_id].push(a);
    });

    setAttachmentMap(map);
  }, [dayTrades]);

  useEffect(() => {
    if (!open) return;
    void loadDayAttachments();
  }, [open, loadDayAttachments]);

  const stats = useMemo(() => {
    const winners = dayTrades.filter((t) => netPnl(t) > 0).length;
    const losers = dayTrades.filter((t) => netPnl(t) < 0).length;
    const grossPnl = dayTrades.reduce((s, t) => s + t.pnl_gross, 0);
    const totalFees = dayTrades.reduce((s, t) => s + (t.fees || 0), 0);
    const totalPnl = grossPnl - totalFees;
    const winRate = dayTrades.length > 0 ? Math.round((winners / dayTrades.length) * 100) : 0;
    return { total: dayTrades.length, winners, losers, grossPnl, totalFees, totalPnl, winRate };
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

  const openPreview = (tradeId: string) => {
    const atts = attachmentMap[tradeId];
    if (!atts || atts.length === 0) return;
    setPreviewImages(atts.map((a) => a.preview_url));
    setPreviewIdx(0);
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
                    {dayTrades.map((t) => {
                      const hasImages = (attachmentMap[t.id]?.length || 0) > 0;
                      return (
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
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openPreview(t.id)}
                                disabled={!hasImages}
                                className={`transition-colors ${hasImages ? "text-primary hover:text-primary/80" : "text-muted-foreground/30 cursor-not-allowed"}`}
                                title={hasImages ? "View screenshots" : "No screenshots"}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setSelectedTrade(t)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Edit details & upload"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

      {previewImages.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center"
          onClick={() => setPreviewImages([])}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-background/20 text-foreground hover:bg-background/40 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImages([]);
            }}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImages[previewIdx]}
            alt="preview"
            className="max-w-[95vw] max-h-[92vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {previewImages.length > 1 && (
            <div className="flex items-center gap-3 mt-4">
              {previewImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIdx(i);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === previewIdx ? "bg-primary" : "bg-muted-foreground/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTrade && (
        <TradeDetailDialog
          open={!!selectedTrade}
          onOpenChange={(o) => {
            if (!o) {
              setSelectedTrade(null);
              void loadDayAttachments();
            }
          }}
          trade={selectedTrade}
        />
      )}
    </>
  );
};

export default DayDetailDialog;
