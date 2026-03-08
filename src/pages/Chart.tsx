import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Chart = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Chart</h1>
        <p className="text-muted-foreground text-sm">Candlestick chart coming soon.</p>
      </div>
    </div>
  );
};

export default Chart;
