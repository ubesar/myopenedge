// --- NEW UI LAYOUT --- Dashboard far-left navigation sidebar (Edgeful-inspired)
import { useNavigate } from "react-router-dom";
import { BarChart3, FileText, Calculator, Crown, LogOut, Bookmark, TrendingUp } from "lucide-react";
import logo from "@/assets/logo.png";

interface DashboardSidebarProps {
  isActive: boolean;
  onSignOut: () => void;
}

const menuItems = [
  { icon: BarChart3, label: "reports", active: true },
  { icon: TrendingUp, label: "dashboard", active: false },
  { icon: Calculator, label: "risk calculator", active: false },
  { icon: Bookmark, label: "bookmarks", active: false },
];

const DashboardSidebar = ({ isActive, onSignOut }: DashboardSidebarProps) => {
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-border/30 bg-sidebar">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
          <span className="text-sm font-bold text-foreground tracking-tight lowercase">myopenedge</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-2">workspace</p>
        {menuItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              item.active
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span className="lowercase">{item.label}</span>
          </button>
        ))}

        <div className="pt-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-2">resources</p>
          <button
            onClick={() => navigate("/docs")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span className="lowercase">documentation</span>
          </button>
          {!isActive && (
            <button
              onClick={() => navigate("/upgrade")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors"
            >
              <Crown className="h-4 w-4" />
              <span className="lowercase">upgrade to pro</span>
            </button>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border/20">
        {isActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-md bg-primary/10">
            <Crown className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] text-primary font-medium">pro active</span>
          </div>
        )}
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="lowercase">sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
