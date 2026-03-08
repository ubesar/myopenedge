import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Rocket, Bot, BarChart3, Search,
  TrendingUp, Cpu, Eye, Calculator, BookOpen, Users, MessageCircle,
  Gift, Crown, LogOut
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";

interface AppNavSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const workspaceItems = [
  { icon: Rocket, label: "get started", href: "/docs" },
  { icon: Bot, label: "ai assistant", href: "/ai-assistant" },
  { icon: BarChart3, label: "reports", href: "/app" },
  { icon: Search, label: "screener", href: null },
  { icon: TrendingUp, label: "whats in play", href: null },
  { icon: Cpu, label: "algos", href: null },
  { icon: Eye, label: "watchlist", href: null },
  { icon: Calculator, label: "risk calculator", href: null },
];

const communityItems = [
  { icon: BookOpen, label: "blog", href: null },
  { icon: Users, label: "refer a friend", href: null },
  { icon: MessageCircle, label: "discord", href: null },
  { icon: Gift, label: "free resources", href: null },
];

const AppNavSidebar = ({ collapsed, onToggle }: AppNavSidebarProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-secondary"
                } ${!item.href && !item.active ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!item.href && !item.active}
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
            {communityItems.map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] text-sidebar-foreground opacity-50 cursor-not-allowed"
                disabled
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => navigate("/upgrade")}
          className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-primary transition-colors"
          title="Upgrade"
        >
          <Crown className="h-4 w-4" />
          {!collapsed && <span>upgrade</span>}
        </button>
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
