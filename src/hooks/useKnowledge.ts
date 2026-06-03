import { useState, useEffect } from "react";
import { supabase as _supaClient } from "@/integrations/supabase/client";
// @ts-ignore - some tables not in generated types
const supabase: any = _supaClient as any;

import { useAuth } from "@/contexts/AuthContext";

export function useKnowledge() {
  const { user } = useAuth();
  const [knowledgeText, setKnowledgeText] = useState("");

  const fetchKnowledge = async () => {
    if (!user) return "";
    const { data } = await supabase
      .from("ai_knowledge")
      .select("title, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    
    if (data && data.length > 0) {
      const text = data.map((e: any) => `### ${e.title}\n${e.content}`).join("\n\n");
      setKnowledgeText(text);
      return text;
    }
    setKnowledgeText("");
    return "";
  };

  useEffect(() => {
    fetchKnowledge();
  }, [user]);

  return { knowledgeText, refreshKnowledge: fetchKnowledge };
}
