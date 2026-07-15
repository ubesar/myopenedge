import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImagePlus, Trash2, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { extractTradeScreenshotPath, resolveTradeScreenshotUrl } from "@/lib/trade-screenshot-url";

interface Trade {
  id: string;
  pnl_gross: number;
  pnl_net: number;
  fees: number | null;
  side: string;
  close_time: string;
  open_time: string;
  symbol: string;
  qty?: number;
  playbook?: string | null;
  r_multiple?: number | null;
  notes?: string | null;
}

const netPnl = (t: Trade) => t.pnl_gross - (t.fees || 0);

interface Attachment {
  id: string;
  file_url: string;
  file_name: string | null;
  preview_url: string;
}

interface TradeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade;
}

const TradeDetailDialog = ({ open, onOpenChange, trade }: TradeDetailDialogProps) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState(trade.notes || "");
  const [saving, setSaving] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotes(trade.notes || "");
    void fetchAttachments();
  }, [open, trade.id]);

  const fetchAttachments = async () => {
    const { data, error } = await supabase
      .from("attachments")
      .select("id, file_url, file_name")
      .eq("trade_id", trade.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load screenshots");
      return;
    }

    const resolved = await Promise.all(
      ((data as Omit<Attachment, "preview_url">[]) || []).map(async (att) => ({
        ...att,
        preview_url: await resolveTradeScreenshotUrl(att.file_url),
      }))
    );

    setAttachments(resolved);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${trade.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("trade-screenshots")
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("attachments").insert({
      user_id: user.id,
      trade_id: trade.id,
      file_url: path,
      file_name: file.name,
      file_type: file.type,
    });

    if (insertErr) {
      toast.error("Failed to save image");
      setUploading(false);
      return;
    }

    await fetchAttachments();
    setUploading(false);
    toast.success("Image uploaded");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (att: Attachment) => {
    const { error: deleteErr } = await supabase.from("attachments").delete().eq("id", att.id);

    if (deleteErr) {
      toast.error("Failed to delete");
      return;
    }

    const path = extractTradeScreenshotPath(att.file_url);
    if (path) {
      await supabase.storage.from("trade-screenshots").remove([path]);
    }

    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success("Deleted");
  };

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("trades").update({ notes }).eq("id", trade.id);
    setSaving(false);

    if (error) {
      toast.error("Failed to save notes");
      return;
    }

    toast.success("Notes saved");
  };

  const fmtPnl = (n: number) =>
    `${n >= 0 ? "+" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-[14px]">
              Trade Detail — {trade.symbol}
              <span className={`text-[12px] font-bold ${netPnl(trade) >= 0 ? "text-green-400" : "text-red-400"}`}>
                Net {fmtPnl(netPnl(trade))}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-[12px]">
              {[
                { label: "Gross P&L", value: fmtPnl(trade.pnl_gross) },
                { label: "Fees", value: fmtPnl(trade.fees || 0) },
                { label: "Net P&L", value: fmtPnl(netPnl(trade)) },
                { label: "Side", value: trade.side },
                { label: "Qty", value: trade.qty || 1 },
                { label: "Open", value: new Date(trade.open_time).toLocaleString() },
                { label: "Close", value: new Date(trade.close_time).toLocaleString() },
                { label: "Playbook", value: trade.playbook || "-" },
                { label: "R Multiple", value: trade.r_multiple?.toFixed(1) || "-" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={`font-medium mt-0.5 ${item.label === "Net P&L" ? (netPnl(trade) >= 0 ? "text-green-400" : "text-red-400") : "text-foreground"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-medium text-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add trade notes..."
                className="w-full rounded-lg border border-border bg-background p-3 text-[12px] text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={saveNotes}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Notes"}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-foreground">Screenshots</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-secondary text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                  Add Image
                </button>
              </div>

              {attachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <div key={att.id} className="relative group rounded-lg overflow-hidden border border-border">
                      <img
                        src={att.preview_url}
                        alt={att.file_name || "screenshot"}
                        className="w-full h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImg(att.preview_url)}
                      />
                      <button
                        onClick={() => handleDelete(att)}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">No screenshots yet.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {previewImg && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewImg(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-background/20 text-foreground hover:bg-background/40"
            onClick={() => setPreviewImg(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img src={previewImg} alt="preview" className="max-w-[95vw] max-h-[92vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
};

export default TradeDetailDialog;
