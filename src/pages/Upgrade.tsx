import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, Loader2, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

const features = [
  "Unlimited IB, Momentum & OCC Analysis",
  "Unlimited tickers",
  "5000 bars intraday data",
  "Breakout Probability Stats",
  "Daily Setup Recommendations",
  "Priority support",
];

const Upgrade = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const [processing, setProcessing] = useState(false);
  const [paddle, setPaddle] = useState<Paddle | null>(null);

  useEffect(() => {
    initializePaddle({
      environment: "sandbox",
      token: "test_906ae7bf74bbcaf25341c87dd7f",
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          toast.success("Payment successful! Your Pro access is being activated...");
          // Refresh subscription status after a short delay
          setTimeout(() => window.location.reload(), 3000);
        }
        if (event.name === "checkout.closed") {
          setProcessing(false);
        }
      },
    }).then((p) => {
      if (p) setPaddle(p);
    });
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
    if (!paddle || !user) {
      toast.error("Checkout not ready. Please try again.");
      return;
    }
    setProcessing(true);
    paddle.Checkout.open({
      items: [{ priceId: "pri_01kk6rkazpp86ckkdf76wtbg9s", quantity: 1 }],
      customData: { user_id: user.id },
      customer: { email: user.email || "" },
    });
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
              <span className="text-5xl font-bold">$3</span>
              <span className="text-muted-foreground">/month</span>
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
                "Subscribe Now"
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">Secure checkout powered by Paddle</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Upgrade;
