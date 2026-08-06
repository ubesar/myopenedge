import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdminCheck } from "@/hooks/useAdminCheck";

const ProRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdminCheck();

  if (authLoading || subLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm lowercase">
        loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isActive && !isAdmin) return <Navigate to="/upgrade" replace />;

  return <>{children}</>;
};

export default ProRoute;
