import { useNavigate } from "react-router-dom";
import { BarChart3, Activity, Target, Zap, Shield, TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpg";

const features = [
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

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />

        {/* Navbar */}
        <nav className="relative z-10 w-full border-b border-border/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            </div>
            <Button
              onClick={() => navigate("/app")}
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              Launch App
            </Button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
              Decode the Market
              <br />
              With{" "}
              <span className="text-primary">IB & Momentum Data</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Spot Initial Balance breakouts & momentum candles instantly. Turn raw 5-min data into actionable trading setups.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                onClick={() => navigate("/pricing")}
                className="text-base px-8 py-6 rounded-full"
              >
                Subscription
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pb-20 -mt-8">
          <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md p-6 shadow-2xl shadow-primary/5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "IB Breakout Rate", value: "73%", color: "text-emerald-400" },
                { label: "Momentum Accuracy", value: "68%", color: "text-primary" },
                { label: "Trading Days Analyzed", value: "100+", color: "text-amber-400" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border/40 bg-muted/30 p-4 text-center"
                >
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">
              Everything You Need for{" "}
              <span className="text-primary">IB & Momentum Analysis</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Professional tools to decode Initial Balance breakouts and momentum candle patterns.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border/50 bg-card/50 p-6 hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Get Started in <span className="text-primary">3 Steps</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Enter API Key", desc: "Sign up for free at TwelveData and enter your API key." },
              { step: "02", title: "Select Ticker & Mode", desc: "Choose a stock ticker and analysis mode (IB or Momentum)." },
              { step: "03", title: "Analyze & Trade", desc: "View breakout statistics and daily setup recommendations." },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-3">
                <div className="text-4xl font-bold text-primary/30">{s.step}</div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border/30">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to decode your <span className="text-primary">edge</span>?
          </h2>
          <p className="text-muted-foreground">
            Start analyzing IB breakouts and momentum candles with real data. Free.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/app")}
            className="text-base px-8 py-6 rounded-full"
          >
            Launch MyOpenEdge
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="MyOpenEdge" className="h-5 w-5 rounded-full object-cover" />
            <span className="font-semibold text-foreground">MyOpenEdge</span>
            <span>· Auction Market Theory</span>
          </div>
          <p>© 2026 MyOpenEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
