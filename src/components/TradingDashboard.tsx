import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  TrendingUp,
  TrendingDown,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Zap,
  Activity,
  Radio,
  Lock,
  Settings2,
  ChevronUp,
  Save,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";

const COMMANDS = {
  BUY_STOP: "BUY_STOP",
  SELL_STOP: "SELL_STOP",
  CLOSE_ALL: "CLOSE_ALL",
  NONE: "NONE"
} as const;

type Command = (typeof COMMANDS)[keyof typeof COMMANDS];

interface EAControl {
  id: string;
  magic_number: number;
  current_command: Command;
  is_active: boolean;
  asset_name: string;
  updated_at: string;
  lot_size: number;
  risk_usd: number;
  stop_loss: number;
  take_profit: number;
  max_orders: number;
  trailing_stop: number;
  breakeven: number;
  slippage: number;
  order_distance: number;
  rr_ratio: number;
}

const PARAM_CONFIG = [
  { key: "lot_size", label: "Lot Size", min: 0, max: 100, step: 0.01, suffix: "lot" },
  { key: "risk_usd", label: "Risk USD", min: 0, max: 10000, step: 1, suffix: "$" },
  { key: "max_orders", label: "Max Orders", min: 1, max: 50, step: 1, suffix: "" },
] as const;

const TradingDashboard = ({ user, onLock }: { user: User; onLock?: () => void }) => {
  const [eaControls, setEaControls] = useState<EAControl[]>([]);
  const [newMagic, setNewMagic] = useState("");
  const [newAsset, setNewAsset] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [nyTime, setNyTime] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editParams, setEditParams] = useState<Record<string, Partial<EAControl>>>({});
  const [savingParams, setSavingParams] = useState<string | null>(null);

  const fetchControls = async (isInitial = false) => {
    const { data } = await supabase
      .from("ea_control")
      .select("*")
      .eq("user_id", user.id)
      .order("magic_number");
    if (data) setEaControls(data as unknown as EAControl[]);
    if (isInitial) setInitialLoading(false);
  };

  const addMagicNumber = async () => {
    const magic = parseInt(newMagic);
    if (isNaN(magic) || magic <= 0) {
      toast.error("Magic number must be a positive number");
      return;
    }
    if (!newAsset.trim()) {
      toast.error("Asset name is required");
      return;
    }
    const { error } = await supabase.from("ea_control").insert({
      user_id: user.id,
      magic_number: magic,
      asset_name: newAsset.trim().toUpperCase(),
      current_command: "NONE",
      is_active: true,
    });
    if (error) {
      toast.error(error.code === "23505" ? "Magic number already exists" : error.message);
      return;
    }
    setNewMagic("");
    setNewAsset("");
    setShowAdd(false);
    fetchControls();
    toast.success(`${newAsset.trim().toUpperCase()} added`);
  };

  const deleteMagicNumber = async (magic: number) => {
    await supabase.from("ea_control").delete().eq("user_id", user.id).eq("magic_number", magic);
    fetchControls();
    toast.success("Instrument removed");
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    if (isActive) {
      const otherIds = eaControls.filter((c) => c.id !== id && c.is_active).map((c) => c.id);
      if (otherIds.length > 0) {
        await supabase.from("ea_control").update({ is_active: false }).in("id", otherIds);
      }
      await supabase.from("ea_control").update({ is_active: true }).eq("id", id);
      setEaControls((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: true } : { ...c, is_active: false }))
      );
    } else {
      await supabase.from("ea_control").update({ is_active: false }).eq("id", id);
      setEaControls((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: false } : c))
      );
    }
  };

  const sendCommand = async (command: Command) => {
    const activeControls = eaControls.filter((c) => c.is_active);
    if (activeControls.length === 0) {
      toast.error("No active instruments");
      return;
    }
    setLoading(command);
    const activeIds = activeControls.map((c) => c.id);
    const { error } = await supabase
      .from("ea_control")
      .update({ current_command: command, updated_at: new Date().toISOString() })
      .in("id", activeIds);
    if (!error) {
      setEaControls((prev) =>
        prev.map((c) => (c.is_active ? { ...c, current_command: command } : c))
      );
      const names = activeControls.map((c) => c.asset_name || "Unnamed").join(", ");
      toast.success(`${command.replace("_", " ")} → ${names}`);
    }
    setLoading(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const control = eaControls.find((c) => c.id === id);
      if (control) {
        setEditParams((prev) => ({
          ...prev,
          [id]: {
            lot_size: control.lot_size,
            risk_usd: control.risk_usd,
            stop_loss: control.stop_loss,
            take_profit: control.take_profit,
            max_orders: control.max_orders,
            trailing_stop: control.trailing_stop,
            breakeven: control.breakeven,
            slippage: control.slippage,
            order_distance: control.order_distance,
            rr_ratio: control.rr_ratio,
          },
        }));
      }
    }
  };

  const updateParam = (id: string, key: string, value: number) => {
    setEditParams((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const saveParams = async (id: string) => {
    const params = editParams[id];
    if (!params) return;
    setSavingParams(id);
    const { error } = await supabase
      .from("ea_control")
      .update({
        lot_size: params.lot_size,
        risk_usd: params.risk_usd,
        stop_loss: params.stop_loss,
        take_profit: params.take_profit,
        max_orders: params.max_orders,
        trailing_stop: params.trailing_stop,
        breakeven: params.breakeven,
        slippage: params.slippage,
        order_distance: params.order_distance,
        rr_ratio: params.rr_ratio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error("Gagal menyimpan parameter");
    } else {
      toast.success("Parameter disimpan");
      fetchControls();
    }
    setSavingParams(null);
  };

  useEffect(() => {
    const updateClock = () => {
      setNyTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchControls(true);
    const interval = setInterval(fetchControls, 3000);
    return () => clearInterval(interval);
  }, []);

  const activeAsset = eaControls.find((c) => c.is_active);
  const activeCount = eaControls.filter((c) => c.is_active).length;

  const getCommandLabel = (cmd: string) => {
    switch (cmd) {
      case "BUY_STOP": return "Buy Stop";
      case "SELL_STOP": return "Sell Stop";
      case "CLOSE_ALL": return "Close All";
      default: return "Idle";
    }
  };

  const getCommandColor = (cmd: string) => {
    switch (cmd) {
      case "BUY_STOP": return "text-buy";
      case "SELL_STOP": return "text-sell";
      case "CLOSE_ALL": return "text-warning";
      default: return "text-muted-foreground";
    }
  };

  const getStatusDot = (cmd: string) => {
    switch (cmd) {
      case "BUY_STOP": return "bg-buy";
      case "SELL_STOP": return "bg-sell";
      case "CLOSE_ALL": return "bg-warning";
      default: return "bg-muted-foreground/30";
    }
  };

  return (
    <div className="min-h-screen framer-gradient-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-2xl">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-foreground tracking-tight leading-none">Algo Control</span>
              <span className="text-[11px] text-muted-foreground leading-none mt-0.5 hidden sm:block">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/downloads/pasticuanlagi.ex5"
              download="pasticuanlagi.ex5"
              className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10"
              title="Download EA"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download EA</span>
            </a>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px] tabular-nums text-foreground/70">{nyTime}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">est</span>
            </div>
            {onLock && (
              <button onClick={onLock} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent" title="Lock">
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        {/* Active Status Card */}
        {activeAsset && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="framer-card framer-shimmer p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl framer-card-inner flex items-center justify-center">
                  <Radio className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Active Instrument</p>
                  <p className="text-lg font-semibold text-foreground tracking-tight">{activeAsset.asset_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${getStatusDot(activeAsset.current_command)} ${activeAsset.current_command !== "NONE" ? "animate-pulse" : ""}`} />
                <span className={`font-mono text-sm font-semibold ${getCommandColor(activeAsset.current_command)}`}>
                  {getCommandLabel(activeAsset.current_command)}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-5 gap-2">
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Lot</p>
                <p className="font-mono text-[12px] text-foreground/80">{activeAsset.lot_size || "Auto"}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Risk</p>
                <p className="font-mono text-[12px] text-foreground/80">{activeAsset.risk_usd ? `$${activeAsset.risk_usd}` : "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">RR</p>
                <p className="font-mono text-[12px] text-foreground/80">1:{activeAsset.rr_ratio}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">SL</p>
                <p className="font-mono text-[12px] text-foreground/80">{activeAsset.stop_loss || "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Max</p>
                <p className="font-mono text-[12px] text-foreground/80">{activeAsset.max_orders}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Command Buttons */}
        {eaControls.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[13px] font-semibold text-foreground">Commands</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => sendCommand("BUY_STOP")}
                disabled={loading !== null || activeCount === 0}
                className="group framer-card framer-shimmer p-0 overflow-hidden transition-all duration-300 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="p-5 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl framer-card-inner flex items-center justify-center group-hover:border-buy/30 transition-colors">
                    <TrendingUp className="w-6 h-6 text-buy" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{loading === "BUY_STOP" ? "Sending..." : "Buy Stop"}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight text-center">Place buy stop order</span>
                </div>
                {loading === "BUY_STOP" && <div className="absolute inset-0 rounded-[var(--radius)] glow-buy pointer-events-none" />}
              </button>

              <button
                onClick={() => sendCommand("SELL_STOP")}
                disabled={loading !== null || activeCount === 0}
                className="group framer-card framer-shimmer p-0 overflow-hidden transition-all duration-300 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="p-5 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl framer-card-inner flex items-center justify-center group-hover:border-sell/30 transition-colors">
                    <TrendingDown className="w-6 h-6 text-sell" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{loading === "SELL_STOP" ? "Sending..." : "Sell Stop"}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight text-center">Place sell stop order</span>
                </div>
                {loading === "SELL_STOP" && <div className="absolute inset-0 rounded-[var(--radius)] glow-sell pointer-events-none" />}
              </button>

              <button
                onClick={() => sendCommand("CLOSE_ALL")}
                disabled={loading !== null || activeCount === 0}
                className="group framer-card framer-shimmer p-0 overflow-hidden transition-all duration-300 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="p-5 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl framer-card-inner flex items-center justify-center group-hover:border-warning/30 transition-colors">
                    <XCircle className="w-6 h-6 text-warning" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{loading === "CLOSE_ALL" ? "Sending..." : "Close All"}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight text-center">Close all positions</span>
                </div>
                {loading === "CLOSE_ALL" && <div className="absolute inset-0 rounded-[var(--radius)] glow-warning pointer-events-none" />}
              </button>
            </div>
          </motion.section>
        )}

        {/* Instruments Section */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[13px] font-semibold text-foreground">Instruments</h2>
              {eaControls.length > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{eaControls.length}</span>
              )}
            </div>
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {/* Add form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden mb-3">
                <div className="framer-card p-4 flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] text-muted-foreground font-medium">Asset Name</label>
                    <Input type="text" placeholder="e.g. XAUUSD" value={newAsset} onChange={(e) => setNewAsset(e.target.value)} className="framer-input h-9 text-xs font-mono rounded-lg" />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-[11px] text-muted-foreground font-medium">Magic #</label>
                    <Input type="number" placeholder="12345" value={newMagic} onChange={(e) => setNewMagic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMagicNumber()} className="framer-input h-9 text-xs font-mono rounded-lg" />
                  </div>
                  <Button size="sm" onClick={addMagicNumber} className="h-9 text-xs px-4 rounded-lg">Add</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instrument list */}
          <div className="framer-card framer-shimmer overflow-hidden">
            {initialLoading ? (
              <div className="space-y-0">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? "border-t border-border/30" : ""}`}>
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-4 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="w-20 h-3.5 rounded" />
                        <Skeleton className="w-12 h-2.5 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-1.5 h-1.5 rounded-full" />
                      <Skeleton className="w-5 h-5 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : eaControls.length === 0 ? (
              <div className="text-center py-14 px-6">
                <div className="w-12 h-12 rounded-xl framer-card-inner flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground/60 mb-1">No instruments yet</p>
                <p className="text-xs text-muted-foreground/50">Add a magic number matching your EA to get started</p>
              </div>
            ) : (
              eaControls.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`${c.is_active ? "bg-accent/30" : "opacity-40 hover:opacity-60"} ${i > 0 ? "border-t border-border/30" : ""} transition-all duration-200`}
                >
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Switch checked={c.is_active} onCheckedChange={(checked) => toggleActive(c.id, checked)} className="scale-[0.8]" />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-foreground tracking-tight leading-none">{c.asset_name || "Unnamed"}</span>
                        <span className={`text-[10px] font-mono mt-1 leading-none ${getCommandColor(c.current_command)}`}>{getCommandLabel(c.current_command)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(c.current_command)} ${c.current_command !== "NONE" ? "animate-pulse" : ""}`} />
                      <button onClick={() => toggleExpand(c.id)} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
                        {expandedId === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => deleteMagicNumber(c.magic_number)} className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Parameters Panel */}
                  <AnimatePresence>
                    {expandedId === c.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 border-t border-border/20">
                          {/* RR Ratio Selector */}
                          <div className="mt-2 mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Risk : Reward</label>
                              <span className="font-mono text-[11px] text-foreground/80">1:{editParams[c.id]?.rr_ratio ?? c.rr_ratio}</span>
                            </div>
                            <div className="flex gap-2">
                              {[1, 2, 3].map((rr) => {
                                const isSelected = (editParams[c.id]?.rr_ratio ?? c.rr_ratio) === rr;
                                return (
                                  <button
                                    key={rr}
                                    onClick={() => updateParam(c.id, "rr_ratio", rr)}
                                    className={`flex-1 h-9 rounded-lg text-[12px] font-semibold font-mono transition-all duration-200 border ${
                                      isSelected
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-accent/50 text-muted-foreground border-border/40 hover:bg-accent hover:text-foreground"
                                    }`}
                                  >
                                    1:{rr}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {PARAM_CONFIG.map((param) => {
                              const val = (editParams[c.id]?.[param.key as keyof EAControl] as number) ?? (c[param.key as keyof EAControl] as number);
                              return (
                                <div key={param.key} className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{param.label}</label>
                                    <span className="font-mono text-[11px] text-foreground/80">
                                      {val} {param.suffix}
                                    </span>
                                  </div>
                                  <Input
                                    type="number"
                                    value={val}
                                    min={param.min}
                                    max={param.max}
                                    step={param.step}
                                    onChange={(e) => updateParam(c.id, param.key, parseFloat(e.target.value) || 0)}
                                    className="framer-input h-8 text-[11px] font-mono rounded-lg"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => saveParams(c.id)}
                              disabled={savingParams === c.id}
                              className="h-8 text-[11px] px-4 rounded-lg gap-1.5"
                            >
                              <Save className="w-3 h-3" />
                              {savingParams === c.id ? "Saving..." : "Save Parameters"}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* Footer */}
        <div className="pt-6 pb-4">
          <p className="text-center text-[11px] text-muted-foreground/40">
            EA endpoint → <span className="font-mono text-muted-foreground/60">/get-command?magic=XXX</span>
          </p>
        </div>
      </main>
    </div>
  );
};

export default TradingDashboard;
