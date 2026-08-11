import { useState, useEffect, useCallback } from "react";
import { supabase as _supaClient } from "@/integrations/supabase/client";
// @ts-ignore - some tables not in generated types
const supabase: any = _supaClient as any;
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, Trash2, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus,
  Search, BarChart3
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface WatchlistItem {
  id: string;
  symbol: string;
  created_at: string;
}

interface QuoteData {
  symbol: string;
  name: string;
  close: string;
  previous_close: string;
  change: string;
  percent_change: string;
  open: string;
  high: string;
  low: string;
  volume: string;
  is_market_open: boolean;
}

const Watchlist = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load watchlist");
      return;
    }
    setItems(data || []);
    setLoading(false);
  }, [user]);

  const fetchQuote = useCallback(async (symbol: string): Promise<QuoteData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("twelvedata-proxy", {
        body: { symbol, endpoint: "quote" },
      });
      if (error || data?.status === "error") return null;
      return data as QuoteData;
    } catch {
      return null;
    }
  }, []);

  const refreshAllQuotes = useCallback(async () => {
    if (items.length === 0) return;
    setRefreshing(true);
    const results: Record<string, QuoteData> = {};
    // Fetch in batches of 3 to avoid rate limits
    for (let i = 0; i < items.length; i += 3) {
      const batch = items.slice(i, i + 3);
      const promises = batch.map(async (item) => {
        const q = await fetchQuote(item.symbol);
        if (q) results[item.symbol] = q;
      });
      await Promise.all(promises);
    }
    setQuotes(results);
    setRefreshing(false);
  }, [items, fetchQuote]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (items.length > 0) {
      refreshAllQuotes();
    }
  }, [items.length]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const addSymbol = async () => {
    if (!newSymbol.trim() || !user) return;
    const sym = newSymbol.trim().toUpperCase();
    if (items.some((i) => i.symbol === sym)) {
      toast.error(`${sym} sudah ada di watchlist`);
      return;
    }
    setAddingSymbol(true);
    const { error } = await supabase.from("watchlist").insert({
      user_id: user.id,
      symbol: sym,
    });
    if (error) {
      toast.error(error.code === "23505" ? "Sudah ada" : error.message);
    } else {
      setNewSymbol("");
      fetchItems();
      toast.success(`${sym} ditambahkan`);
    }
    setAddingSymbol(false);
  };

  const removeSymbol = async (id: string, symbol: string) => {
    const { error } = await supabase.from("watchlist").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(`${symbol} dihapus`);
    }
  };

  const getChangeColor = (change: string) => {
    const val = parseFloat(change);
    if (val > 0) return "text-primary";
    if (val < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const getChangeIcon = (change: string) => {
    const val = parseFloat(change);
    if (val > 0) return <TrendingUp className="h-3.5 w-3.5" />;
    if (val < 0) return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {isMobile && <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="watchlist" />}
      {!isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
      {isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[17px] font-semibold text-foreground lowercase">watchlist</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {items.length} ticker{items.length !== 1 ? "s" : ""} · harga live dari TwelveData
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAllQuotes}
              disabled={refreshing || items.length === 0}
              className="text-[12px] gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              refresh
            </Button>
          </div>

          {/* Add Symbol */}
          <form
            onSubmit={(e) => { e.preventDefault(); addSymbol(); }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tambah ticker (e.g. QQQ, NQ, GC)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="pl-9 bg-input border-border text-[13px] uppercase"
              />
            </div>
            <Button type="submit" size="sm" disabled={addingSymbol || !newSymbol.trim()} className="gap-1.5 text-[12px]">
              {addingSymbol ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              tambah
            </Button>
          </form>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && items.length === 0 && (
            <div className="border border-dashed border-border rounded-xl p-12 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground">watchlist kosong</p>
              <p className="text-[11px] text-muted-foreground mt-1">tambahkan ticker untuk mulai memantau harga</p>
            </div>
          )}

          {/* Watchlist Table */}
          {!loading && items.length > 0 && (
            <div className="border border-border rounded-xl bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-medium">symbol</th>
                    <th className="px-4 py-3 text-right font-medium">price</th>
                    <th className="px-4 py-3 text-right font-medium">change</th>
                    <th className="px-4 py-3 text-right font-medium">%</th>
                    <th className="px-4 py-3 text-right font-medium">high</th>
                    <th className="px-4 py-3 text-right font-medium">low</th>
                    <th className="px-4 py-3 text-right font-medium">volume</th>
                    <th className="px-4 py-3 text-center font-medium w-[80px]">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const q = quotes[item.symbol];
                    return (
                      <tr key={item.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-foreground">{item.symbol}</span>
                            {q?.name && <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{q.name}</span>}
                            {q?.is_market_open && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Market Open" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[13px] text-foreground">
                          {q ? parseFloat(q.close).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-[12px] ${q ? getChangeColor(q.change) : "text-muted-foreground"}`}>
                          {q ? (
                            <span className="flex items-center justify-end gap-1">
                              {getChangeIcon(q.change)}
                              {parseFloat(q.change).toFixed(2)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-[12px] ${q ? getChangeColor(q.percent_change) : "text-muted-foreground"}`}>
                          {q ? `${parseFloat(q.percent_change).toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[12px] text-muted-foreground">
                          {q ? parseFloat(q.high).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[12px] text-muted-foreground">
                          {q ? parseFloat(q.low).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[12px] text-muted-foreground">
                          {q?.volume ? parseInt(q.volume).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/app`)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Analyze"
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => removeSymbol(item.id, item.symbol)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        </div>
      </main>
    </div>
  );
};

export default Watchlist;
