import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import JournalStatsCards from "@/components/journal/JournalStatsCards";
import JournalCharts from "@/components/journal/JournalCharts";
import JournalCalendar from "@/components/journal/JournalCalendar";
import TradovateImport from "@/components/journal/TradovateImport";
import { Loader2, Calendar, BarChart3, Upload, X } from "lucide-react";

interface Trade {
  id: string;
  pnl_net: number;
  side: string;
  close_time: string;
  open_time: string;
  symbol: string;
}

const Journal = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"all" | "30d" | "7d">("all");
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?redirect=/journal");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchTrades = async () => {
      setLoading(true);
      let query = supabase
        .from("trades")
        .select("id, pnl_net, side, close_time, open_time, symbol")
        .eq("user_id", user.id)
        .order("close_time", { ascending: false });

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
  }, [user, dateFilter, refreshKey]);

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
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold text-foreground">Trading Journal</h1>
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
                  onClick={() => setShowImport(!showImport)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium gap-1.5 flex items-center transition-colors ${
                    showImport
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {showImport ? <X className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                  Import
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <BarChart3 className="h-10 w-10 opacity-40" />
                <p className="text-sm">No trades found. Start logging your trades!</p>
              </div>
            ) : (
              <>
                <JournalStatsCards trades={trades} />
                <JournalCharts trades={trades} />
                <JournalCalendar trades={trades} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Journal;
