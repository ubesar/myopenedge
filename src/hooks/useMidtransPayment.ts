import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type PaymentStatus = "idle" | "creating" | "pending" | "settlement" | "failed";

export function useMidtransPayment() {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createTransaction = useCallback(async () => {
    setStatus("creating");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "midtrans-create-transaction"
      );

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const { token, redirect_url, order_id } = data;
      setOrderId(order_id);
      setStatus("pending");

      // Try Snap popup first, fallback to redirect
      if ((window as any).snap) {
        (window as any).snap.pay(token, {
          onSuccess: () => setStatus("settlement"),
          onPending: () => setStatus("pending"),
          onError: () => setStatus("failed"),
          onClose: () => {
            // User closed popup without finishing
          },
        });
      } else if (redirect_url) {
        window.location.href = redirect_url;
      }

      return { token, redirect_url, order_id };
    } catch (err: any) {
      setError(err.message || "Gagal membuat transaksi");
      setStatus("failed");
      return null;
    }
  }, []);

  const pollStatus = useCallback(
    async (midtransOrderId: string): Promise<string | null> => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("midtrans_order_id" as any, midtransOrderId)
        .single();
      return (data as any)?.status || null;
    },
    []
  );

  return { status, orderId, error, createTransaction, pollStatus };
}
