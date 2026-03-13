import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock, Info, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
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
  "works on futures (nq, gc) and idx",
  "real-time market probabilities & statistics",
  "order flow analysis tools",
  "myopenedge proprietary screeners",
  "advanced trading journal",
  "ninjatrader premium indicators",
  "bookmarks, watchlists, custom sessions",
  "discord community of dedicated traders",
];

const featureBreakdown = [
  {
    category: "data & analytics",
    items: [
      { name: "stocks, futures, forex, crypto", included: true },
      { name: "6 analysis report types", included: true },
      { name: "initial balance (IB) breakout analysis", included: true },
      { name: "momentum candle detection", included: true },
      { name: "opening candle continuation (OCC)", included: true },
      { name: "gap fill, inside bar, outside day", included: true },
      { name: "up to 12 months historical data", included: true },
      { name: "custom lookback & weekday filters", included: true },
    ]
  },
  {
    category: "tools & integrations",
    items: [
      { name: "AI chart analysis assistant", included: true },
      { name: "custom analysis templates", included: true },
      { name: "real-time TwelveData API", included: true },
      { name: "TradingView chart integration", included: true },
      { name: "EA remote control panel", included: true },
      { name: "watchlist manager", included: true },
    ]
  },
  {
    category: "algo trading",
    items: [
      { name: "expert advisor (EA) download", included: true, upgrade: true },
      { name: "remote EA command & control", included: true },
    ]
  }
];

const Landing = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const price = billing === "monthly" ? "49" : "490";
  const period = billing === "monthly" ? "per bulan" : "per tahun";

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ─── Navbar ─── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">pricing</a>
          </div>
          <Button
            onClick={() => navigate("/auth")}
            variant="outline"
            className="border-primary/50 text-primary hover:bg-primary/10">
            launch app
          </Button>
        </div>
      </motion.nav>

      {/* ─── Hero / Pricing Section ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="text-center mb-8 sm:mb-10">
            <p className="text-xs sm:text-sm font-bold tracking-[0.2em] text-primary uppercase mb-4">
              LEBIH MURAH DARI SATU KALI CUT LOSS
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3">
              where consistent trading begins
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              only if you're serious about trading
            </p>
          </motion.div>

          {/* Billing Toggle */}
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col items-center gap-2 mb-12 sm:mb-16">
            <div className="inline-flex rounded-full border border-border/50 p-1 bg-muted/30">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billing === "monthly" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
                monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billing === "yearly" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
                yearly
              </button>
            </div>
            {billing === "yearly" && (
              <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full font-medium">save 20% yearly</span>
            )}
          </motion.div>

          {/* Price + Features Grid */}
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Left: Price */}
            <div className="flex flex-col items-center lg:items-start">
              <div className="relative">
                <span className="text-muted-foreground text-xl sm:text-2xl font-light absolute -left-8 sm:-left-10 top-6 sm:top-8">Rp</span>
                <span className="text-8xl sm:text-9xl md:text-[140px] font-extrabold leading-none tracking-tighter bg-gradient-to-b from-foreground via-foreground/80 to-muted-foreground/40 bg-clip-text text-transparent">
                  {price}
                </span>
                <span className="text-muted-foreground text-xl sm:text-2xl font-light">rb</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{period}</p>
              <Button
                size="lg"
                onClick={() => navigate("/upgrade")}
                className="mt-8 text-base px-10 py-6 rounded-md w-full max-w-xs font-bold">
                mulai berlangganan
              </Button>
            </div>

            {/* Right: Feature Card */}
            <div className="rounded-xl border border-primary/30 bg-card p-6 sm:p-8">
              <h3 className="text-base font-bold mb-4">fitur esensial</h3>
              <div className="border-t border-border/30 pt-4">
                <ul className="space-y-3">
                  {essentialFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-border/30 flex items-center gap-2 text-xs text-muted-foreground/60">
                <Lock className="h-3.5 w-3.5" />
                <span>ninja script & copy trading not included | upgrade in app</span>
                <Info className="h-3.5 w-3.5 ml-1" />
              </div>
            </div>
          </motion.div>
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
            <p className="text-xs sm:text-sm font-bold tracking-[0.2em] text-primary uppercase mb-3">
              IF YOU ARE HAVING SECOND THOUGHTS
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">feature breakdown</h2>
            <p className="text-sm text-muted-foreground mb-6">trust us, we didn't miss a spot</p>
            <Button
              size="lg"
              onClick={() => navigate("/upgrade")}
              className="text-base px-10 py-6 rounded-md font-bold">
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
              <h3 className="text-base font-bold mb-4">{group.category}</h3>
              <div className="divide-y divide-border/20">
                {group.items.map((item) => (
                  <motion.div
                    key={item.name}
                    variants={staggerItem}
                    className="flex items-center justify-between py-3.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{item.name}</span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                      {item.upgrade && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">upgrade required</span>
                      )}
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
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
            ready to decode your <span className="text-primary">edge</span>?
          </h2>
          <p className="text-muted-foreground">
            mulai dari Rp 49.000/bulan. analisis IB, momentum, OCC & lainnya dengan data real-time.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/upgrade")}
            className="text-base px-10 py-6 rounded-md font-bold">
            mulai berlangganan
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="MyOpenEdge" className="h-5 w-5 rounded-full object-cover" />
            <span className="font-semibold text-foreground">MyOpenEdge</span>
            <span>· market analysis platform</span>
          </div>
          <p>© 2026 MyOpenEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
