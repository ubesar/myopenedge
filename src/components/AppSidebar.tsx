import { useState } from "react";
import {
  LayoutDashboard, Rocket, BarChart3, Search, Zap, Bot, List, Calculator,
  ChevronLeft, ChevronRight, Crown,
} from "lucide-react";
import logo from "@/assets/logo.png";

interface AppSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isActive: boolean;
}

const menuItems = [
  { id: "workspace", icon: LayoutDashboard, label: "workspace" },
  { id: "get-started", icon: Rocket, label: "get started" },
  { id: "reports", icon: BarChart3, label: "reports" },
  { id: "screener", icon: Search, label: "screener" },
  { id: "whats-in-play", icon: Zap, label: "whats in play" },
  { id: "algos", icon: Bot, label: "algos" },
  { id: "watchlist", icon: List, label: "watchlist" },
  { id: "risk-calculator", icon: Calculator, label: "risk calculator" },
  { id: "docs", icon: BarChart3, label: "docs" },
];

const AppSidebar = ({ activeItem, onItemClick, isActive }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? "w-[56px]" : "w-[220px]"} shrink-0 border-r border-border/50 bg-sidebar flex flex-col h-full transition-all duration-200 relative`}
    >
      {/* Logo */}
      <div className={`px-3 py-4 flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
        <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-lg object-cover shrink-0" />
        {!collapsed && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold text-foreground tracking-tight truncate">myopenedge</span>
            {isActive && <Crown className="h-3.5 w-3.5 text-primary shrink-0" />}
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[52px] z-10 h-6 w-6 rounded-full border border-border/50 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-2.5 rounded-md text-[13px] transition-colors lowercase ${
                collapsed ? "px-0 py-2 justify-center" : "px-3 py-2"
              } ${
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-border/30">
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground lowercase text-center">powered by twelvedata</p>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
