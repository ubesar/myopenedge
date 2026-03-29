import { useState, useRef } from "react";
import { Upload, FileText, Check, Loader2 } from "lucide-react";
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

  // Detected accounts from CSV
  const detectedAccounts = parsed
    ? [...new Set(parsed.map((t) => t.account_name))]
    : [];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const trades = parseTradovateCSV(text);
    setParsed(trades);
    if (trades.length === 0) {
      toast.error("No filled trades found in this CSV.");
    } else {
      const accounts = [...new Set(trades.map((t) => t.account_name))];
      toast.info(`Detected ${accounts.length} account(s): ${accounts.join(", ")}`);
    }
  };

  const handleImport = async () => {
    if (!parsed?.length || !user) return;
    setImporting(true);

    try {
      // 1. Get or create accounts for each detected account name
      const accountIdMap = new Map<string, string>();

      for (const accountName of detectedAccounts) {
        // Check if account already exists
        const { data: existing } = await supabase
          .from("accounts")
          .select("id")
          .eq("user_id", user.id)
          .eq("name", accountName)
          .maybeSingle();

        if (existing) {
          accountIdMap.set(accountName, existing.id);
        } else {
          // Auto-create account
          const { data: created, error } = await supabase
            .from("accounts")
            .insert({
              user_id: user.id,
              name: accountName,
              broker: "Tradovate",
              account_type: "propfirm",
              currency: "USD",
            })
            .select("id")
            .single();

          if (error) throw error;
          accountIdMap.set(accountName, created.id);
        }
      }

      // 2. Create import batch
      const { data: batch, error: batchErr } = await supabase
        .from("import_batches")
        .insert({
          user_id: user.id,
          source: "TRADOVATE",
          file_name: fileName,
          status: "processing",
          rows_count: parsed.length,
        })
        .select("id")
        .single();

      if (batchErr) throw batchErr;

      // 3. Deduplicate — check existing trades by key fields
      const { data: existingTrades } = await supabase
        .from("trades")
        .select("symbol, side, qty, entry_price, exit_price, open_time, close_time")
        .eq("user_id", user.id)
        .eq("source", "TRADOVATE");

      const existingKeys = new Set(
        (existingTrades || []).map((t) =>
          `${t.symbol}|${t.side}|${t.qty}|${t.entry_price}|${t.exit_price}|${t.open_time}|${t.close_time}`
        )
      );

      const newTrades = parsed.filter((t) => {
        const key = `${t.symbol}|${t.side}|${t.qty}|${t.entry_price}|${t.exit_price}|${t.open_time}|${t.close_time}`;
        return !existingKeys.has(key);
      });

      if (newTrades.length === 0) {
        toast.info("Semua trade sudah pernah di-import sebelumnya. Tidak ada data baru.");
        await supabase.from("import_batches").update({ status: "skipped", completed_at: new Date().toISOString() }).eq("id", batch.id);
        setParsed(null);
        setFileName("");
        setImporting(false);
        return;
      }

      const skipped = parsed.length - newTrades.length;
      if (skipped > 0) {
        toast.info(`${skipped} trade duplikat dilewati.`);
      }

      // 4. Insert only new trades
      const rows = newTrades.map((t) => ({
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
        account_id: accountIdMap.get(t.account_name) || null,
      }));

      const { error: insertErr } = await supabase.from("trades").insert(rows);
      if (insertErr) throw insertErr;

      // 4. Update batch status
      await supabase
        .from("import_batches")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", batch.id);

      toast.success(`${newTrades.length} trade baru di-import${skipped > 0 ? ` (${skipped} duplikat dilewati)` : ""} across ${detectedAccounts.length} account(s)!`);
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
              Accounts are auto-detected from CSV
            </p>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          {/* File info + detected accounts */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-[12px] font-medium text-foreground flex-1 truncate">{fileName}</span>
            <span className="text-[11px] text-muted-foreground">{parsed.length} trades</span>
          </div>

          {/* Detected accounts */}
          {detectedAccounts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detectedAccounts.map((acc) => {
                const accTrades = parsed.filter((t) => t.account_name === acc);
                const accPnl = accTrades.reduce((s, t) => s + t.pnl_net, 0);
                return (
                  <div
                    key={acc}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[11px] font-mono font-medium text-foreground">{acc}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {accTrades.length}t
                    </span>
                    <span className={`text-[10px] font-bold ${accPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmt(accPnl)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Preview table */}
          {parsed.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-secondary/50 text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Account</th>
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
                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                          {t.account_name.slice(0, 10)}…
                        </td>
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
              <div className="px-3 py-2 bg-secondary/30 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {parsed.length} trades · {detectedAccounts.length} account(s)
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
