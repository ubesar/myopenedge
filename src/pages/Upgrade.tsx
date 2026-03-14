import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, Loader2, Lock, Shield, Zap } from "lucide-react";
import logo from "@/assets/logo.png";
import { MidtransCheckout } from "@/components/MidtransCheckout";

const features = [
  "unlimited IB, momentum & OCC analysis",
  "inside bar & outside day reports",
  "gap fill analysis tools",
  "up to 12 months historical data",
  "AI chart analysis assistant",
  "custom watchlists & analysis templates",
  "algos command center access",
  "priority support",
];

const Upgrade = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();

  if (!authLoading && !user) {
    navigate("/auth?redirect=/upgrade");
    return null;
  }

  if (subLoading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0066FF]" />
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-white">
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="rounded-xl border border-[#0066FF]/30 bg-[#111827]/80 backdrop-blur-sm p-10 text-center max-w-md">
            <Shield className="h-12 w-12 text-[#0066FF] mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 lowercase">you're a pro!</h2>
            <p className="text-gray-400 mb-6">Your subscription is active. Enjoy full access to all features.</p>
            <Button onClick={() => navigate("/app")} className="bg-[#0066FF] hover:bg-[#0052CC] text-white">
              go to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white overflow-x-hidden font-sans">
      {/* Gradient overlays */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0A0D14] via-[#0d1120] to-[#0A0D14] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(0,102,255,0.08),transparent)] pointer-events-none" />

      <div className="relative z-10">
        {/* Navbar */}
        <nav className="w-full border-b border-gray-800/40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
            </button>
            <Button
              onClick={() => navigate("/")}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> back
            </Button>
          </div>
        </nav>

        {/* Header */}
        <section className="pt-16 pb-4 px-6 text-center">
          <p className="text-[#0066FF] text-sm font-bold uppercase tracking-wide mb-3">
            UPGRADE TO PRO
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white lowercase mb-3">
            unlock your full <span className="text-[#0066FF]">trading edge</span>
          </h1>
          <p className="text-gray-400 text-lg lowercase">
            full access to all analysis tools & features
          </p>
        </section>

        {/* Pricing Grid */}
        <section className="px-4 sm:px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left - Price & CTA */}
              <div className="flex flex-col items-center justify-center lg:pt-12">
                <div className="flex items-start justify-center mb-2">
                  <span className="text-gray-400 text-2xl font-medium mt-4 mr-1">Rp</span>
                  <span className="text-white text-8xl md:text-9xl font-bold tracking-tighter">
                    49
                  </span>
                  <span className="text-white text-3xl md:text-4xl font-bold mt-6 ml-1">rb</span>
                </div>
                <p className="text-gray-400 text-sm mb-8 lowercase">per bulan</p>

                <div className="w-full max-w-xs">
                  <MidtransCheckout />
                </div>
              </div>

              {/* Right - Feature Card */}
              <div className="bg-[#111827] border border-[#0066FF]/30 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-[#0066FF]" />
                  <h3 className="text-white font-bold text-lg lowercase">pro features</h3>
                </div>
                <div className="h-px bg-[#0066FF]/20 mb-4" />

                <ul className="space-y-3">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#0066FF]/20 flex items-center justify-center mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[#0066FF]" strokeWidth={3} />
                      </span>
                      <span className="text-gray-300 lowercase">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-4 border-t border-gray-800">
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Lock className="w-3 h-3" />
                    <span className="lowercase">
                      cancel anytime · secure payment via midtrans
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800/30 px-6 py-8 mt-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <img src={logo} alt="MyOpenEdge" className="h-5 w-5 rounded-full object-cover" />
              <span className="font-semibold text-white">MyOpenEdge</span>
              <span>· Auction Market Theory</span>
            </div>
            <p>© 2026 MyOpenEdge. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Upgrade;
