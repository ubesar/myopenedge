import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { AnalysisMode } from "@/components/ControlPanel";
import type { MomentumBodyRatio, OCCBodyRatio, OCCTimeframe } from "@/components/ParameterPanel";

export interface AnalysisTemplate {
  id: string;
  name: string;
  mode: string;
  symbol: string;
  ib_window: number;
  max_days: number;
  body_ratio: string;
  occ_body_ratio: string;
  occ_timeframe: string;
  weekdays: number[];
  created_at: string;
}

export interface TemplateParams {
  mode: AnalysisMode;
  symbol: string;
  ibWindow: number;
  maxDays: number;
  bodyRatio: MomentumBodyRatio;
  occBodyRatio: OCCBodyRatio;
  occTimeframe: OCCTimeframe;
  weekdays: number[];
}

export const useTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("analysis_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setTemplates(data as AnalysisTemplate[]);
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const saveTemplate = async (name: string, params: TemplateParams) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("analysis_templates").upsert(
      {
        user_id: user.id,
        name,
        mode: params.mode,
        symbol: params.symbol,
        ib_window: params.ibWindow,
        max_days: params.maxDays,
        body_ratio: params.bodyRatio,
        occ_body_ratio: params.occBodyRatio,
        occ_timeframe: params.occTimeframe,
      },
      { onConflict: "user_id,name" }
    );
    setLoading(false);
    if (error) {
      toast.error("Gagal menyimpan template");
    } else {
      toast.success(`Template "${name}" tersimpan`);
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("analysis_templates").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus template");
    } else {
      toast.success("Template dihapus");
      fetchTemplates();
    }
  };

  return { templates, loading, saveTemplate, deleteTemplate, fetchTemplates };
};
