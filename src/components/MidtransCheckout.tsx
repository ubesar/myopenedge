import { useEffect, useRef } from "react";
import { useMidtransPayment } from "@/hooks/useMidtransPayment";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const MIDTRANS_CLIENT_KEY = "Mid-client-OuPZeQ0Ax78FetwU";
const SNAP_JS_URL = "https://app.sandbox.midtrans.com/snap/snap.js";

export function MidtransCheckout() {
  const navigate = useNavigate();
  const { status, orderId, error, createTransaction, pollStatus } =
    useMidtransPayment();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load Snap.js script
  useEffect(() => {
    if (document.getElementById("midtrans-snap-js")) return;
    const script = document.createElement("script");
    script.id = "midtrans-snap-js";
    script.src = SNAP_JS_URL;
    script.setAttribute("data-client-key", MIDTRANS_CLIENT_KEY);
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Poll for payment completion
  useEffect(() => {
    if (status === "pending" && orderId) {
      pollRef.current = setInterval(async () => {
        const s = await pollStatus(orderId);
        if (s === "settlement") {
          toast.success("Pembayaran berhasil! Akun Pro Anda aktif.");
          clearInterval(pollRef.current!);
          setTimeout(() => navigate("/app"), 2000);
        } else if (s === "failed") {
          toast.error("Pembayaran gagal.");
          clearInterval(pollRef.current!);
        }
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, orderId, pollStatus, navigate]);

  useEffect(() => {
    if (status === "settlement") {
      toast.success("Pembayaran berhasil! Akun Pro Anda aktif.");
      setTimeout(() => navigate("/app"), 2000);
    }
  }, [status, navigate]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const isProcessing = status === "creating" || status === "pending";

  return (
    <div className="mt-4 pt-4 border-t border-border/40">
      <p className="text-xs text-muted-foreground mb-3 text-center">
        🇮🇩 Bayar dengan metode lokal Indonesia
      </p>
      <Button
        onClick={createTransaction}
        disabled={isProcessing}
        variant="outline"
        className="w-full"
        size="lg"
      >
        {status === "creating" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses…
          </>
        ) : status === "pending" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menunggu
            pembayaran…
          </>
        ) : (
          "Bayar dengan Midtrans (Rp 49.000)"
        )}
      </Button>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        QRIS · GoPay · Dana · Bank Transfer · Kartu Kredit
      </p>
    </div>
  );
}
