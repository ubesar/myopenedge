import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpg";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/forever",
    description: "Start exploring AMT analysis with basic features.",
    features: [
      "IB Analysis (limited)",
      "Momentum Candle Detection",
      "5 tickers per day",
      "Last 30 days of data",
      "Community support",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For serious traders who need maximum edge.",
    features: [
      "Unlimited IB Analysis",
      "Unlimited Momentum Analysis",
      "Unlimited tickers",
      "Up to 1 year of data",
      "IB Extension Targets",
      "Volume Profile Overlay",
      "Priority support",
      "CSV data export",
    ],
    cta: "Subscribe Now",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "Complete solution for teams and institutions.",
    features: [
      "All Pro features",
      "Multi-user access",
      "Custom API integration",
      "Dedicated account manager",
      "Custom indicators",
      "White-label option",
      "99.9% uptime SLA",
      "Phone & video support",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover opacity-20 z-0"
      >
        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background z-0" />

      {/* Content */}
      <div className="relative z-10">
        {/* Navbar */}
        <nav className="w-full border-b border-border/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
            </button>
            <Button
              onClick={() => navigate("/")}
              variant="ghost"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </nav>

        {/* Header */}
        <section className="pt-20 pb-12 px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Simple, Transparent <span className="text-primary">Pricing</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Choose the plan that fits your trading needs. Upgrade or downgrade anytime.
          </p>
        </section>

        {/* Pricing Cards */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-8 flex flex-col transition-all duration-300 backdrop-blur-sm ${
                  plan.highlighted
                    ? "border-primary bg-card/90 shadow-xl shadow-primary/10 scale-[1.02]"
                    : "border-border/50 bg-card/50 hover:border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.highlighted ? "" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                  size="lg"
                  onClick={() => navigate("/app")}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
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
    </div>
  );
};

export default Pricing;
