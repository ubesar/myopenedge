import { BarChart3, Rocket, FileText, Monitor, TrendingUp, Bot, List, Calculator, Crown } from "lucide-react";
import logo from "@/assets/logo.png";

interface AppSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isActive: boolean;
}

const menuItems = [
  { id: "reports", icon: BarChart3, label: "reports" },
  { id: "docs", icon: FileText, label: "docs" },
];

const AppSidebar = ({ activeItem, onItemClick, isActive }: AppSidebarProps) => {
  return (
    <aside className="w-[200px] shrink-0 border-r border-border/30 bg-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2">
        <img src={logo} alt="MyOpenEdge" className="h-7 w-7 rounded-full object-cover" />
        <span className="text-sm font-bold text-foreground tracking-tight">myopenedge</span>
        {isActive && (
          <span className="ml-auto">
            <Crown className="h-3.5 w-3.5 text-primary" />
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors lowercase ${
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-border/20">
        <p className="text-[10px] text-muted-foreground lowercase text-center">powered by twelvedata</p>
      </div>
    </aside>
  );
};

export default AppSidebar;
