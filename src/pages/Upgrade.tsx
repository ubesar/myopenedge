import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, Loader2, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const features = [
  "Unlimited IB, Momentum & OCC Analysis",
  "Unlimited tickers",
  "5000 bars intraday data",
  "Breakout Probability Stats",
  "Daily Setup Recommendations",
  "Priority support",
];

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: {
        onSuccess: (result: any) => void;
        onPending: (result: any) => void;
        onError: (result: any) => void;
        onClose: () => void;
      }) => void;
    };
  }
}

const Upgrade = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const [processing, setProcessing] = useState(false);
  const [snapReady, setSnapReady] = useState(false);

  // Load Midtrans Snap JS
  useEffect(() => {
    const loadSnap = async () => {
      const existingScript = document.getElementById("midtrans-snap");
      if (existingScript) {
        setSnapReady(true);
        return;
      }

      try {
        const res = await supabase.functions.invoke("midtrans-config");
        if (res.error || !res.data?.client_key) return;

        const { client_key, is_production } = res.data;
        const script = document.createElement("script");
        script.id = "midtrans-snap";
        script.src = is_production
          ? "https://app.midtrans.com/snap/snap.js"
          : "https://app.sandbox.midtrans.com/snap/snap.js";
        script.setAttribute("data-client-key", client_key);
        script.onload = () => setSnapReady(true);
        document.head.appendChild(script);
      } catch (err) {
        console.error("Failed to load Midtrans config:", err);
      }
    };

    loadSnap();
  }, []);

  if (!authLoading && !user) {
    navigate("/auth?redirect=/upgrade");
    return null;
  }

  if (subLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover opacity-20 z-0">
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background z-0" />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm p-10 text-center max-w-md">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're a Pro!</h2>
            <p className="text-muted-foreground mb-6">Your subscription is active. Enjoy full access to all features.</p>
            <Button onClick={() => navigate("/app")}>Go to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const handleUpgrade = async () => {
    setProcessing(true);
    try {
      const res = await supabase.functions.invoke("create-midtrans-transaction", {
        body: { origin: window.location.origin },
      });

      if (res.error) throw new Error(res.error.message);

      const { snap_token, redirect_url } = res.data;

      if (snap_token && snapReady && window.snap) {
        window.snap.pay(snap_token, {
          onSuccess: () => {
            toast.success("Pembayaran berhasil! Subscription aktif.");
            navigate("/app?payment=success");
          },
          onPending: () => {
            toast.info("Pembayaran pending. Silakan selesaikan pembayaran.");
          },
          onError: (result: any) => {
            console.error("Payment error:", result);
            toast.error("Pembayaran gagal. Silakan coba lagi.");
          },
          onClose: () => {
            toast.info("Pembayaran dibatalkan.");
          },
        });
      } else if (redirect_url) {
        window.location.href = redirect_url;
      } else {
        throw new Error("No payment method available");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat pembayaran");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover opacity-20 z-0">
        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background z-0" />

      <div className="relative z-10">
        <nav className="w-full border-b border-border/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
            </button>
            <Button onClick={() => navigate("/")} variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>
        </nav>

        <section className="flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
          <div className="rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm p-6 sm:p-10 max-w-md w-full text-center">
            <Zap className="h-8 w-8 sm:h-10 sm:w-10 text-primary mx-auto mb-3 sm:mb-4" />
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Upgrade to Pro</h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-2">Full access to all IB, Momentum & OCC tools</p>
            <div className="mb-6">
              <span className="text-5xl font-bold">Rp 50K</span>
              <span className="text-muted-foreground">/bulan</span>
            </div>

            <ul className="space-y-3 mb-8 text-left">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <Button onClick={handleUpgrade} disabled={processing} className="w-full" size="lg">
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                "Bayar Sekarang"
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">Powered by Midtrans · Semua metode pembayaran</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Upgrade;
