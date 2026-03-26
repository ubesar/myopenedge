import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import TradingDashboard from "@/components/TradingDashboard";
import PinLock from "@/components/PinLock";
import { Crown, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const Algos = () => {
  const { user, loading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  if (loading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth?redirect=/algos");
    return null;
  }

  if (!isActive) {
    return (
      <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
        {isMobile && <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="algos" />}
        {!isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
        {isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-xl border border-primary/20 bg-card/80 backdrop-blur-sm p-10 text-center max-w-md">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Pro Feature</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Algos command center is exclusively available for Pro members. Upgrade to get full access.
            </p>
            <Button onClick={() => navigate("/upgrade")} size="lg" className="gap-2">
              <Crown className="h-4 w-4" /> Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return <PinLock userId={user.id} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      {isMobile && <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="algos" />}
      {!isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
      {isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
      <div className="flex-1 overflow-auto">
        <TradingDashboard user={user} onLock={() => setUnlocked(false)} />
      </div>
    </div>
  );
};

export default Algos;
