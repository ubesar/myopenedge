import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase as _supaClient } from "@/integrations/supabase/client";
// @ts-ignore - some tables not in generated types
const supabase: any = _supaClient as any;

import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import JournalStatsCards from "@/components/journal/JournalStatsCards";
import JournalCharts from "@/components/journal/JournalCharts";
import JournalCalendar from "@/components/journal/JournalCalendar";
import DayDetailDialog from "@/components/journal/DayDetailDialog";
import TradovateImport from "@/components/journal/TradovateImport";
import ImportHistory from "@/components/journal/ImportHistory";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Calendar, BarChart3, Upload, ChevronDown, History } from "lucide-react";

interface Trade {
  id: string;
  pnl_net: number;
  side: string;
  close_time: string;
  open_time: string;
  symbol: string;
  account_id: string | null;
  qty: number;
  playbook: string | null;
  r_multiple: number | null;
  notes: string | null;
}

interface Account {
  id: string;
  name: string;
  broker: string | null;
  account_type: string | null;
}

const Journal = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"all" | "30d" | "7d">("all");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [showImport, setShowImport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/journal");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("accounts")
      .select("id, name, broker, account_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAccounts((data as Account[]) || []));
  }, [user, refreshKey]);

  useEffect(() => {
    if (!user) return;
    const fetchTrades = async () => {
      setLoading(true);
      let query = supabase
        .from("trades")
        .select("id, pnl_net, side, close_time, open_time, symbol, account_id, qty, playbook, r_multiple, notes")
        .eq("user_id", user.id)
        .order("close_time", { ascending: false });

      if (selectedAccount !== "all") {
        query = query.eq("account_id", selectedAccount);
      }

      if (dateFilter === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = query.gte("close_time", d.toISOString());
      } else if (dateFilter === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = query.gte("close_time", d.toISOString());
      }

      const { data } = await query;
      setTrades((data as Trade[]) || []);
      setLoading(false);
    };
    fetchTrades();
  }, [user, dateFilter, selectedAccount, refreshKey]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const filters = [
    { label: "All Time", value: "all" as const },
    { label: "30 Days", value: "30d" as const },
    { label: "7 Days", value: "7d" as const },
  ];

  const selectedAccountName =
    selectedAccount === "all"
      ? "All Accounts"
      : accounts.find((a) => a.id === selectedAccount)?.name || "Account";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppNavSidebar
        collapsed={isMobile ? !mobileOpen : collapsed}
        onToggle={() => (isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed))}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {isMobile && (
          <MobileHeader onMenuToggle={() => setMobileOpen(!mobileOpen)} title="journal" />
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold text-foreground">Trading Journal</h1>

                {accounts.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAccountPicker(!showAccountPicker)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-card border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-foreground max-w-[140px] truncate">{selectedAccountName}</span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>

                    {showAccountPicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowAccountPicker(false)} />
                        <div className="absolute top-full left-0 mt-1 z-50 w-[240px] rounded-lg border border-border bg-card shadow-xl py-1">
                          <button
                            onClick={() => { setSelectedAccount("all"); setShowAccountPicker(false); }}
                            className={`w-full text-left px-3 py-2 text-[12px] hover:bg-accent transition-colors ${
                              selectedAccount === "all" ? "text-primary font-semibold" : "text-foreground"
                            }`}
                          >
                            All Accounts
                          </button>
                          {accounts.map((acc) => (
                            <button
                              key={acc.id}
                              onClick={() => { setSelectedAccount(acc.id); setShowAccountPicker(false); }}
                              className={`w-full text-left px-3 py-2 text-[12px] hover:bg-accent transition-colors flex items-center justify-between ${
                                selectedAccount === acc.id ? "text-primary font-semibold" : "text-foreground"
                              }`}
                            >
                              <span className="truncate">{acc.name}</span>
                              {acc.account_type && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground ml-2 shrink-0">
                                  {acc.account_type}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setDateFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                      dateFilter === f.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowHistory(true)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium gap-1.5 flex items-center transition-colors bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <History className="h-3 w-3" />
                  History
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium gap-1.5 flex items-center transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="h-3 w-3" />
                  Import
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-3">
                <BarChart3 className="h-10 w-10 opacity-40" />
                <p className="text-sm">No trades found{selectedAccount !== "all" ? " for this account" : ""}.</p>
                <button
                  onClick={() => setShowImport(true)}
                  className="text-[12px] text-primary hover:text-primary/80 font-medium flex items-center gap-1.5"
                >
                  <Upload className="h-3 w-3" /> Import from Tradovate
                </button>
              </div>
            ) : (
              <>
                <JournalStatsCards trades={trades} />
                <JournalCharts trades={trades} />
                <JournalCalendar trades={trades} onDayClick={(d) => setSelectedDay(d)} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <DayDetailDialog
        open={!!selectedDay}
        onOpenChange={(o) => !o && setSelectedDay(null)}
        date={selectedDay || ""}
        trades={trades}
      />

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Upload className="h-4 w-4 text-primary" />
              Import CSV
            </DialogTitle>
          </DialogHeader>
          <TradovateImport onImportComplete={() => { setShowImport(false); setRefreshKey((k) => k + 1); }} />
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <History className="h-4 w-4 text-primary" />
              Import History
            </DialogTitle>
          </DialogHeader>
          <ImportHistory refreshKey={refreshKey} onDelete={() => setRefreshKey((k) => k + 1)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Journal;
