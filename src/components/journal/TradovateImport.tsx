import { useState, useRef } from "react";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseTradovateCSV, type ParsedTrade } from "@/lib/tradovate-parser";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TradovateImportProps {
  onImportComplete: () => void;
}

const TradovateImport = ({ onImportComplete }: TradovateImportProps) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedTrade[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const trades = parseTradovateCSV(text);
    setParsed(trades);
    if (trades.length === 0) {
      toast.error("No filled trades found in this CSV.");
    }
  };

  const handleImport = async () => {
    if (!parsed?.length || !user) return;
    setImporting(true);

    try {
      // Create import batch
      const { data: batch, error: batchErr } = await supabase
        .from("import_batches")
        .insert({ user_id: user.id, source: "TRADOVATE", file_name: fileName, status: "processing", rows_count: parsed.length })
        .select("id")
        .single();

      if (batchErr) throw batchErr;

      // Insert trades
      const rows = parsed.map((t) => ({
        user_id: user.id,
        symbol: t.symbol,
        side: t.side,
        qty: t.qty,
        entry_price: t.entry_price,
        exit_price: t.exit_price,
        open_time: t.open_time,
        close_time: t.close_time,
        pnl_gross: t.pnl_gross,
        pnl_net: t.pnl_net,
        source: "TRADOVATE",
        import_batch_id: batch.id,
      }));

      const { error: insertErr } = await supabase.from("trades").insert(rows);
      if (insertErr) throw insertErr;

      // Update batch status
      await supabase
        .from("import_batches")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", batch.id);

      toast.success(`${parsed.length} trades imported from Tradovate!`);
      setParsed(null);
      setFileName("");
      onImportComplete();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const fmt = (n: number) => (n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`);

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />

      {!parsed ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors flex flex-col items-center gap-3"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Upload Tradovate Orders CSV</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Export from Tradovate → Orders → Download CSV
            </p>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          {/* File info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-[12px] font-medium text-foreground flex-1 truncate">{fileName}</span>
            <span className="text-[11px] text-muted-foreground">{parsed.length} trades</span>
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-secondary/50 text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Symbol</th>
                      <th className="px-3 py-2 text-left font-medium">Side</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Entry</th>
                      <th className="px-3 py-2 text-right font-medium">Exit</th>
                      <th className="px-3 py-2 text-right font-medium">PNL</th>
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((t, i) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-accent/30">
                        <td className="px-3 py-2 font-medium text-foreground">{t.symbol}</td>
                        <td className={`px-3 py-2 font-medium ${t.side === "long" ? "text-green-400" : "text-red-400"}`}>
                          {t.side.toUpperCase()}
                        </td>
                        <td className="px-3 py-2 text-right text-foreground">{t.qty}</td>
                        <td className="px-3 py-2 text-right text-foreground">{t.entry_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-foreground">{t.exit_price.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${t.pnl_net >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {fmt(t.pnl_net)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{t.close_time.replace("T", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Summary */}
              <div className="px-3 py-2 bg-secondary/30 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Total: {parsed.length} trades
                </span>
                <span className={`text-[12px] font-bold ${parsed.reduce((s, t) => s + t.pnl_net, 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {fmt(parsed.reduce((s, t) => s + t.pnl_net, 0))}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setParsed(null); setFileName(""); }}
              className="text-[12px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || parsed.length === 0}
              className="text-[12px] gap-2"
            >
              {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Import {parsed.length} Trades
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradovateImport;
