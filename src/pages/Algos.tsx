import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppNavSidebar from "@/components/AppNavSidebar";
import TradingDashboard from "@/components/TradingDashboard";
import PinLock from "@/components/PinLock";

const Algos = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth?redirect=/algos");
    return null;
  }

  if (!unlocked) {
    return <PinLock userId={user.id} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppNavSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 overflow-auto">
        <TradingDashboard user={user} onLock={() => setUnlocked(false)} />
      </div>
    </div>
  );
};

export default Algos;
