import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Lock, Info } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }
  })
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } }
};

const essentialFeatures = [
  "Works on futures, stocks, forex, and crypto",
  "6 data-driven reports & analysis modes",
  "IB Breakout, Momentum, OCC, Gap Fill, Inside Bar, Outside Day",
  "Up to 12 months historical data",
  "Weekday filtering for custom analysis",
  "AI-powered chart analysis assistant",
  "Real-time TwelveData market data",
  "Custom analysis templates",
  "Bookmarks & watchlists",
  "EA remote control panel",
  "24/7 support via community",
];

const featureBreakdown = [
  {
    category: "data & analytics",
    items: [
      { name: "Stocks, futures, forex, crypto", included: true },
      { name: "6 analysis report types", included: true },
      { name: "Initial Balance (IB) breakout analysis", included: true },
      { name: "Momentum candle detection", included: true },
      { name: "Opening Candle Continuation (OCC)", included: true },
      { name: "Gap fill, Inside Bar, Outside Day", included: true },
      { name: "Up to 12 months historical data", included: true },
      { name: "Custom lookback & weekday filters", included: true },
    ],
  },
  {
    category: "tools & integrations",
    items: [
      { name: "AI chart analysis assistant", included: true },
      { name: "Custom analysis templates", included: true },
      { name: "Real-time TwelveData API", included: true },
      { name: "TradingView chart integration", included: true },
      { name: "EA remote control panel", included: true },
      { name: "Watchlist manager", included: true },
    ],
  },
  {
    category: "algo trading",
    items: [
      { name: "Expert Advisor (EA) download", included: true, upgrade: true },
      { name: "Remote EA command & control", included: true },
    ],
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.4, 0.85]);

  const price = billing === "monthly" ? "49.000" : "490.000";
  const period = billing === "monthly" ? "per bulan" : "per tahun";

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ─── Hero / Pricing Section ─── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col overflow-hidden">
        <motion.video
          autoPlay loop muted playsInline
          style={{ y: videoY, scale: videoScale }}
          className="absolute inset-0 w-full h-full object-cover opacity-20">
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </motion.video>
        <motion.div
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />

        {/* Navbar */}
        <motion.nav
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full border-b border-border/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            </div>
            <Button
              onClick={() => navigate("/auth")}
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10">
              Launch App
            </Button>
          </div>
        </motion.nav>

        {/* Pricing Hero Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-5xl mx-auto w-full">

            {/* Heading */}
            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="text-center mb-8 sm:mb-12">
              <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-primary uppercase mb-3">less than the profits of one trade</p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3">where consistent trading begins</h1>
              <p className="text-sm sm:text-base text-muted-foreground">only if you're serious about trading</p>
            </motion.div>

            {/* Billing Toggle */}
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col items-center gap-2 mb-10 sm:mb-16">
              <div className="inline-flex rounded-full border border-border/50 p-1 bg-muted/30 backdrop-blur-sm">
                <button
                  onClick={() => setBilling("monthly")}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billing === "monthly" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
                >
                  monthly
                </button>
                <button
                  onClick={() => setBilling("yearly")}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billing === "yearly" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
                >
                  yearly
                </button>
              </div>
              {billing === "yearly" && (
                <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full font-medium">save 20% yearly</span>
              )}
            </motion.div>

            {/* Price + Features Grid */}
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible"
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

              {/* Left: Price */}
              <div className="text-center lg:text-left">
                <div className="relative inline-block">
                  <span className="text-muted-foreground text-2xl sm:text-3xl font-light absolute -left-6 sm:-left-8 top-4 sm:top-6">Rp</span>
                  <span className="text-7xl sm:text-8xl md:text-[120px] font-bold leading-none tracking-tighter bg-gradient-to-b from-foreground to-muted-foreground/60 bg-clip-text text-transparent">
                    {billing === "monthly" ? "49" : "490"}
                  </span>
                  <span className="text-muted-foreground text-2xl sm:text-3xl font-light">.000</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{period}</p>
                <Button
                  size="lg"
                  onClick={() => navigate("/upgrade")}
                  className="mt-6 text-base px-10 py-6 rounded-full w-full max-w-xs">
                  get started now
                </Button>
              </div>

              {/* Right: Essential Features */}
              <div className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-md p-6 sm:p-8">
                <h3 className="text-base font-bold mb-5 lowercase">essential features</h3>
                <ul className="space-y-3">
                  {essentialFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-4 border-t border-border/30 flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  <span>algos not included | upgrade in app</span>
                  <Info className="h-3.5 w-3.5 ml-1" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Feature Breakdown Section ─── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 border-t border-border/20">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8 sm:mb-12">
            <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-primary uppercase mb-3">if you are having second thoughts</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">feature breakdown</h2>
            <p className="text-sm text-muted-foreground mb-6">trust us, we didn't miss a spot</p>
            <Button
              size="lg"
              onClick={() => navigate("/upgrade")}
              className="text-base px-10 py-6 rounded-full">
              get started now
            </Button>
          </motion.div>

          {featureBreakdown.map((group) => (
            <motion.div
              key={group.category}
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              className="mb-10">
              <h3 className="text-base font-bold mb-4 lowercase">{group.category}</h3>
              <div className="divide-y divide-border/20">
                {group.items.map((item) => (
                  <motion.div
                    key={item.name}
                    variants={staggerItem}
                    className="flex items-center justify-between py-3.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{item.name}</span>
                      {item.upgrade && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">upgrade required</span>
                      )}
                    </div>
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 border-t border-border/20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            Ready to decode your <span className="text-primary">edge</span>?
          </h2>
          <p className="text-muted-foreground">
            Mulai dari Rp 49.000/bulan. Analisis IB, Momentum, OCC & lainnya dengan data real-time.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/upgrade")}
            className="text-base px-8 py-6 rounded-full">
            Get Started Now
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="MyOpenEdge" className="h-5 w-5 rounded-full object-cover" />
            <span className="font-semibold text-foreground">MyOpenEdge</span>
            <span>· Market Analysis Platform</span>
          </div>
          <p>© 2026 MyOpenEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
