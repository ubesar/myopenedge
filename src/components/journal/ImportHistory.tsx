import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// @ts-ignore - some tables not in generated types
const sb: any = supabase as any;
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Loader2, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImportBatch {
  id: string;
  file_name: string | null;
  source: string;
  status: string;
  rows_count: number | null;
  created_at: string;
  completed_at: string | null;
}

interface ImportHistoryProps {
  refreshKey: number;
  onDelete: () => void;
}

const ImportHistory = ({ refreshKey, onDelete }: ImportHistoryProps) => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("import_batches")
      .select("id, file_name, source, status, rows_count, created_at, completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setBatches((data as ImportBatch[]) || []);
        setLoading(false);
      });
  }, [user, refreshKey]);

  const cleanupOrphanAccounts = async () => {
    if (!user) return;
    // Get all accounts
    const { data: accts } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id);
    if (!accts || accts.length === 0) return;

    // For each account, check if any trades remain
    for (const acct of accts) {
      const { count } = await supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("account_id", acct.id);
      if (count === 0) {
        await sb.from("accounts").delete().eq("id", acct.id).eq("user_id", user.id);
      }
    }
  };

  const handleDelete = async (batchId: string, fileName: string | null) => {
    if (!user) return;
    setDeleting(batchId);
    try {
      // 1. Delete trades linked to this batch
      const { error: tradeErr } = await supabase
        .from("trades")
        .delete()
        .eq("user_id", user.id)
        .eq("import_batch_id", batchId);
      if (tradeErr) throw tradeErr;

      // 2. Delete the batch record
      const { error: batchErr } = await supabase
        .from("import_batches")
        .delete()
        .eq("id", batchId)
        .eq("user_id", user.id);
      if (batchErr) throw batchErr;

      // 3. Cleanup orphan accounts (no trades left)
      await cleanupOrphanAccounts();

      toast.success(`Import "${fileName || "batch"}" dan semua trade-nya berhasil dihapus.`);
      setBatches((prev) => prev.filter((b) => b.id !== batchId));
      onDelete();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus import batch");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Package className="h-6 w-6 opacity-40 mb-2" />
        <p className="text-[12px]">Belum ada import history.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-secondary/50 text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">File</th>
            <th className="px-3 py-2 text-left font-medium">Source</th>
            <th className="px-3 py-2 text-right font-medium">Trades</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-center font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} className="border-t border-border/50 hover:bg-accent/30">
              <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">
                {b.file_name || "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{b.source}</td>
              <td className="px-3 py-2 text-right text-foreground">{b.rows_count ?? "—"}</td>
              <td className="px-3 py-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    b.status === "completed"
                      ? "bg-green-500/20 text-green-400"
                      : b.status === "skipped"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {b.status}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {new Date(b.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-3 py-2 text-center">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={deleting === b.id}
                      className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      {deleting === b.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        Hapus Import
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Semua trade dari import "{b.file_name || "batch"}" ({b.rows_count} trades) akan dihapus permanen. Aksi ini tidak bisa di-undo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-[12px]">Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(b.id, b.file_name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[12px]"
                      >
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ImportHistory;
