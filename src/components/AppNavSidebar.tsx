import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Rocket, Bot, BarChart3, CandlestickChart,
  TrendingUp, Cpu, Eye, Users,
  Crown, LogOut
} from "lucide-react";
import logo from "@/assets/logo.png";
import iconX from "@/assets/icon-x.png";
import iconYt from "@/assets/icon-yt.png";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

interface AppNavSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const workspaceItems = [
  { icon: Rocket, label: "get started", href: "/docs" },
  { icon: Bot, label: "ai assistant", href: "/ai-assistant" },
  { icon: BarChart3, label: "reports", href: "/app" },
  { icon: CandlestickChart, label: "chart", href: "/chart" },
  { icon: TrendingUp, label: "whats in play", href: null },
  { icon: Cpu, label: "algos", href: "/algos" },
  { icon: Eye, label: "watchlist", href: null },
  { icon: Calculator, label: "risk calculator", href: null },
];

const communityItems = [
  { icon: Users, label: "refer a friend", href: null, img: null },
  { icon: null, label: "X (Twitter)", href: "https://x.com/Ubetrades", img: iconX },
  { icon: null, label: "YouTube", href: "https://www.youtube.com/@ubetrades", img: iconYt },
];

const AppNavSidebar = ({ collapsed, onToggle }: AppNavSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isActive } = useSubscription();

  return (
    <div
      className={`h-full flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0 ${
        collapsed ? "w-[56px]" : "w-[200px]"
      }`}
    >
      {/* Logo + toggle */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
        <img src={logo} alt="MyOpenEdge" className="h-7 w-7 rounded-full object-cover shrink-0" />
        {!collapsed && (
          <span className="text-[13px] font-semibold text-foreground tracking-tight">myopenedge</span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-2 space-y-4">
        {/* Workspace */}
        <div className="px-3">
          {!collapsed && <p className="section-label mb-2">workspace</p>}
          <div className="space-y-0.5">
            {workspaceItems.map((item) => (
              <button
                key={item.label}
                onClick={() => item.href && navigate(item.href)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${
                  item.href && location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-secondary"
                } ${!item.href ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!item.href}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Community */}
        <div className="px-3">
          {!collapsed && <p className="section-label mb-2">community</p>}
          <div className="space-y-0.5">
            {communityItems.map((item) => {
              const iconEl = item.img
                ? <img src={item.img} alt={item.label} className="h-4 w-4 shrink-0 rounded-sm object-contain" />
                : item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null;
              const isExternal = item.href?.startsWith("http");
              if (isExternal) {
                return (
                  <a
                    key={item.label}
                    href={item.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] text-sidebar-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {iconEl}
                    {!collapsed && <span>{item.label}</span>}
                  </a>
                );
              }
              return (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] text-sidebar-foreground opacity-50 cursor-not-allowed"
                  disabled
                >
                  {iconEl}
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        {isActive ? (
          <div className="flex items-center gap-2 text-[12px] text-primary font-semibold" title="Pro Member">
            <Crown className="h-4 w-4 text-primary" />
            {!collapsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold tracking-wide uppercase">
                Pro
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate("/upgrade")}
            className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-primary transition-colors"
            title="Upgrade"
          >
            <Crown className="h-4 w-4" />
            {!collapsed && <span>upgrade</span>}
          </button>
        )}
        <button
          onClick={signOut}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AppNavSidebar;
