import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type PaymentStatus = "idle" | "creating" | "redirecting" | "failed";

export function useNowPayment() {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const createInvoice = useCallback(
    async (plan: "monthly" | "yearly" = "monthly", currency: "idr" | "usd" = "idr") => {
      setStatus("creating");
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "create-invoice",
          { body: { plan, currency } }
        );

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);

        const { invoice_url } = data;
        if (!invoice_url) throw new Error("No invoice URL returned");

        setStatus("redirecting");
        window.location.href = invoice_url;

        return data;
      } catch (err: any) {
        setError(err.message || "Failed to create payment");
        setStatus("failed");
        return null;
      }
    },
    []
  );

  return { status, error, createInvoice };
}
