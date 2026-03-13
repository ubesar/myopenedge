import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock, BarChart3, Activity, Target, Zap, Shield, TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const appFeatures = [
  {
    icon: BarChart3,
    title: "Initial Balance Analysis",
    desc: "Automatically identify IB High/Low formation and breakout probability from historical data.",
  },
  {
    icon: Activity,
    title: "Momentum Candle Detection",
    desc: "Detect momentum signals from consecutive M15 candles with strong body ratios.",
  },
  {
    icon: Target,
    title: "Breakout Probability",
    desc: "View breakout statistics based on IB High First vs Low First for your trading edge.",
  },
  {
    icon: Zap,
    title: "Real-Time 5min Data",
    desc: "Powered by TwelveData API with 5000 bars of intraday data for deep analysis.",
  },
  {
    icon: Shield,
    title: "M15 Aggregation",
    desc: "Automatic aggregation to M15 timeframe for accurate breakout and momentum detection.",
  },
  {
    icon: TrendingUp,
    title: "Smart Recommendations",
    desc: "Daily setup recommendations based on IB and momentum statistical probabilities.",
  },
];

const essentialFeatures = [
  "works on futures (nq, gc) and idx",
  "real-time market probabilities & statistics",
  "order flow analysis tools",
  "myopenedge proprietary screeners",
  "advanced trading journal",
  "ninjatrader premium indicators",
  "bookmarks, watchlists, custom sessions",
  "discord community of dedicated traders",
];

const Landing = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="min-h-screen bg-[#0A0D14] text-white overflow-x-hidden font-sans">

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex flex-col">
        {/* Gradient overlay instead of video */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0D14] via-[#0d1120] to-[#0A0D14]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(0,102,255,0.08),transparent)]" />

        {/* Navbar */}
        <nav className="relative z-10 w-full border-b border-gray-800/40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
              <a href="#pricing" className="hover:text-white transition-colors">pricing</a>
              <a href="#features" className="hover:text-white transition-colors">features</a>
            </div>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white border-none"
            >
              launch app
            </Button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight lowercase">
              decode the market
              <br />
              with{" "}
              <span className="text-[#0066FF]">IB & momentum data</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              spot Initial Balance breakouts & momentum candles instantly.
              turn raw 5-min data into actionable trading setups.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                onClick={() => {
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-base px-8 py-6 rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white"
              >
                mulai berlangganan
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Preview */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pb-20 -mt-8">
          <div className="rounded-xl border border-gray-800/50 bg-[#111827]/80 backdrop-blur-md p-6 shadow-2xl">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "IB Breakout Rate", value: "73%", color: "text-emerald-400" },
                { label: "Momentum Accuracy", value: "68%", color: "text-[#0066FF]" },
                { label: "Trading Days Analyzed", value: "100+", color: "text-amber-400" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-gray-800/40 bg-[#0A0D14]/50 p-4 text-center"
                >
                  <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing Section ─── */}
      <section id="pricing" className="py-24 px-6 border-t border-gray-800/30">
        <div className="text-center mb-4">
          <p className="text-[#0066FF] text-sm font-bold uppercase tracking-wide mb-3">
            LEBIH MURAH DARI SATU KALI CUT LOSS
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white lowercase mb-3">
            where consistent trading begins
          </h2>
          <p className="text-gray-400 text-lg lowercase">
            only if you're serious about trading
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="flex items-center bg-[#111827] rounded-full p-1 border border-gray-800">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === "monthly"
                    ? "bg-[#0066FF] text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === "yearly"
                    ? "bg-[#0066FF] text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                yearly
              </button>
            </div>
            {billing === "yearly" ? (
              <span className="bg-[#0066FF] text-white text-xs font-medium px-3 py-1 rounded-full lowercase">
                save 20% yearly
              </span>
            ) : (
              <span className="bg-[#0066FF]/20 text-[#0066FF] text-xs font-medium px-3 py-1 rounded-full lowercase">
                save 20% yearly
              </span>
            )}
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="max-w-5xl mx-auto mt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left - Price */}
            <div className="flex flex-col items-center justify-center lg:pt-12">
              <div className="flex items-start justify-center mb-2">
                <span className="text-gray-400 text-2xl font-medium mt-4 mr-1">Rp</span>
                <span className="text-white text-8xl md:text-9xl font-bold tracking-tighter">
                  {billing === "monthly" ? "49" : "490"}
                </span>
                <span className="text-white text-3xl md:text-4xl font-bold mt-6 ml-1">rb</span>
              </div>
              <p className="text-gray-400 text-sm mb-8 lowercase">
                {billing === "monthly" ? "per bulan" : "per tahun"}
              </p>

              <Button
                className="w-full max-w-xs bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold py-4 h-auto rounded-md lowercase transition-colors"
                onClick={() => navigate("/upgrade")}
              >
                mulai berlangganan
              </Button>
            </div>

            {/* Right - Features */}
            <div className="bg-[#111827] border border-[#0066FF]/50 rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-3 lowercase">fitur esensial</h3>
              <div className="h-px bg-[#0066FF]/30 mb-4" />

              <ul className="space-y-3">
                {essentialFeatures.map((feature) => (
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
                    ninja script & copy trading not included | upgrade in app
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section id="features" className="py-24 px-6 border-t border-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold lowercase">
              everything you need for{" "}
              <span className="text-[#0066FF]">IB & momentum analysis</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Professional tools to decode Initial Balance breakouts and momentum candle patterns.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {appFeatures.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-gray-800/50 bg-[#111827]/50 p-6 hover:border-[#0066FF]/30 hover:bg-[#111827]/80 transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-lg bg-[#0066FF]/10 flex items-center justify-center mb-4 group-hover:bg-[#0066FF]/20 transition-colors">
                  <f.icon className="h-5 w-5 text-[#0066FF]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-6 border-t border-gray-800/30">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold lowercase">
            ready to decode your <span className="text-[#0066FF]">edge</span>?
          </h2>
          <p className="text-gray-400">
            mulai dari Rp 49.000/bulan. analisis IB, momentum, OCC & lainnya dengan data real-time.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/upgrade")}
            className="text-base px-8 py-6 rounded-full bg-[#0066FF] hover:bg-[#0052CC] text-white"
          >
            launch MyOpenEdge
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/30 px-6 py-8">
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
  );
};

export default Landing;
