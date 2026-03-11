import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("free");
  const [endDate, setEndDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStatus("free");
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("subscription_status, subscription_end_date")
        .eq("user_id", user.id)
        .single();

      if (data) {
        const profile = data as { subscription_status: string | null; subscription_end_date: string | null };
        if (
          profile.subscription_status === "active" &&
          profile.subscription_end_date &&
          new Date(profile.subscription_end_date) < new Date()
        ) {
          setStatus("expired");
        } else {
          setStatus(profile.subscription_status || "free");
        }
        setEndDate(profile.subscription_end_date);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const isActive = status === "active";

  return { status, endDate, loading, isActive };
}
