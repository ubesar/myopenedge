import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AnalysisRun {
  id: string;
  analysis_type: string;
  symbol: string;
  summary: Record<string, any>;
  created_at: string;
}

export function useAnalysisHistory() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("analysis_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRuns(data as AnalysisRun[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const addRun = useCallback(
    async (analysis_type: string, symbol: string, summary: Record<string, any>) => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("analysis_runs")
        .insert({ user_id: user.id, analysis_type, symbol, summary })
        .select()
        .single();
      if (data) setRuns((prev) => [data as AnalysisRun, ...prev]);
    },
    [user]
  );

  const deleteRun = useCallback(
    async (id: string) => {
      await (supabase as any).from("analysis_runs").delete().eq("id", id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
    },
    []
  );

  return { runs, loading, addRun, deleteRun };
}
