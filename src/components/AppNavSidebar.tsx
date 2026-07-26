import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Rocket, Bot, FlaskConical, CandlestickChart,
  TrendingUp, Cpu, Calculator, Users, BookOpen,
  Crown, LogOut, Menu, X
} from "lucide-react";
import logo from "@/assets/logo.png";
import iconX from "@/assets/icon-x.png";
import iconYt from "@/assets/icon-yt.png";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import ThemeToggle from "@/components/ThemeToggle";

interface AppNavSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const workspaceItems = [
  { icon: Rocket, label: "get started", href: "/docs" },
  { icon: Bot, label: "ai assistant", href: "/ai-assistant" },
  { icon: FlaskConical, label: "edge lab", href: "/app" },
  { icon: CandlestickChart, label: "chart", href: "/chart" },
  { icon: Cpu, label: "algos", href: "/algos" },
  { icon: Calculator, label: "consistency calc", href: "/consistency-calculator" },
  { icon: BookOpen, label: "journal", href: "/journal" },
];

const communityItems = [
  { icon: Users, label: "refer a friend", href: null, img: null },
  { icon: null, label: "X (Twitter)", href: "https://x.com/Ubetrades", img: iconX },
  { icon: null, label: "YouTube", href: "https://www.youtube.com/@ubetrades", img: iconYt },
];

const SidebarContent = ({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isActive } = useSubscription();

  const handleNav = (href: string) => {
    navigate(href);
    onNavigate?.();
  };

  return (
    <div className="h-full flex flex-col">
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
                onClick={() => item.href && handleNav(item.href)}
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
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#D4A017' }} title="Pro Member">
            <Crown className="h-4 w-4" style={{ color: '#D4A017' }} />
            {!collapsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase" style={{ backgroundColor: 'rgba(212, 160, 23, 0.15)', color: '#D4A017' }}>
                Pro
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => handleNav("/upgrade")}
            className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-primary transition-colors"
            title="Upgrade"
          >
            <Crown className="h-4 w-4" />
            {!collapsed && <span>upgrade</span>}
          </button>
        )}
        <ThemeToggle />
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

const AppNavSidebar = ({ collapsed, onToggle }: AppNavSidebarProps) => {
  const isMobile = useIsMobile();

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <>
        {/* Hamburger trigger — rendered by parent via MobileHeader */}
        {!collapsed && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onToggle}
            />
            {/* Drawer */}
            <div className="fixed inset-y-0 left-0 z-50 w-[240px] bg-sidebar border-r border-border shadow-2xl animate-in slide-in-from-left duration-200">
              <SidebarContent collapsed={false} onToggle={onToggle} onNavigate={onToggle} />
            </div>
          </>
        )}
      </>
    );
  }

  // Desktop: normal sidebar
  return (
    <div
      className={`h-full flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0 ${
        collapsed ? "w-[56px]" : "w-[200px]"
      }`}
    >
      <SidebarContent collapsed={collapsed} onToggle={onToggle} />
    </div>
  );
};

export default AppNavSidebar;

/** Mobile header bar with hamburger + optional action buttons */
export const MobileHeader = ({
  onMenuToggle,
  title,
  actions,
}: {
  onMenuToggle: () => void;
  title?: string;
  actions?: React.ReactNode;
}) => (
  <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-3 py-2 border-b border-border bg-background/95 backdrop-blur-sm">
    <button onClick={onMenuToggle} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
      <Menu className="h-5 w-5 text-foreground" />
    </button>
    <img src={logo} alt="" className="h-6 w-6 rounded-full object-cover" />
    {title && <span className="text-[13px] font-semibold text-foreground truncate">{title}</span>}
    {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
  </header>
);
