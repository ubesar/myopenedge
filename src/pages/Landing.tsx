import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Activity, Target, Zap, TrendingUp, ChevronRight, CandlestickChart } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
};

const features = [
{
  icon: BarChart3,
  title: "Initial Balance Analysis",
  desc: "Automatically identify IB High/Low formation and breakout probability from historical data."
},
{
  icon: Activity,
  title: "Momentum Candle Detection",
  desc: "Detect momentum signals from consecutive M15 candles with strong body ratios."
},
{
  icon: CandlestickChart,
  title: "Opening Candle Continuation",
  desc: "Evaluate the first 2 candles after open across M5, M15, M30 & H1 to determine bullish or bearish bias."
},
{
  icon: Target,
  title: "Breakout Probability",
  desc: "View breakout statistics based on IB High First vs Low First for your trading edge."
},
{
  icon: Zap,
  title: "Real-Time Data",
  desc: "Powered by TwelveData API with 5000 bars of intraday data for deep analysis."
},
{
  icon: TrendingUp,
  title: "Smart Recommendations",
  desc: "Daily setup recommendations based on IB, Momentum & OCC statistical probabilities."
}];

const stats = [
  { label: "IB Breakout Rate", value: "73%", color: "text-emerald-400" },
  { label: "OCC Accuracy", value: "71%", color: "text-primary" },
  { label: "Trading Days Analyzed", value: "100+", color: "text-amber-400" },
];

const steps = [
  { step: "01", title: "Enter API Key", desc: "Sign up for free at TwelveData and enter your API key." },
  { step: "02", title: "Select Ticker & Mode", desc: "Choose a stock ticker and analysis mode (IB, Momentum, or OCC)." },
  { step: "03", title: "Analyze & Trade", desc: "View breakout statistics and daily setup recommendations." },
];

const Landing = () => {
  const navigate = useNavigate();

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.4, 0.85]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col overflow-hidden">
        <motion.video
          autoPlay loop muted playsInline
          style={{ y: videoY, scale: videoScale }}
          className="absolute inset-0 w-full h-full object-cover opacity-30">
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </motion.video>
        <motion.div
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background"
        />

        {/* Navbar */}
        <motion.nav
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
          className="relative z-10 w-full border-b border-border/40 backdrop-blur-sm"
        >
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
              onClick={() => navigate("/auth")}
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10">
              Launch App
            </Button>
          </div>
        </motion.nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <motion.h1
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-3xl sm:text-5xl md:text-7xl font-bold leading-tight tracking-tight"
            >
              Decode the Market
              <br />
              With{" "}
              <span className="text-primary">IB, Momentum & OCC Data</span>
            </motion.h1>
            <motion.p
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Spot Initial Balance breakouts, momentum candles & opening candle continuation instantly. Turn raw 5-min data into actionable trading setups.
            </motion.p>
            <motion.div
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            >
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="text-base px-8 py-6 rounded-full">
                Get it Started
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Dashboard Preview Stats */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-20 -mt-4 sm:-mt-8">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
            className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md p-4 sm:p-6 shadow-2xl shadow-primary/5"
          >
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-3 gap-2 sm:gap-4"
            >
              {stats.map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={staggerItem}
                  className="rounded-lg border border-border/40 bg-muted/30 p-2 sm:p-4 text-center"
                >
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">{stat.label}</p>
                  <p className={`text-lg sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 sm:mb-16 space-y-4"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
              Everything You Need for{" "}
              <span className="text-primary">IB, Momentum & OCC Analysis</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Professional tools to decode Initial Balance breakouts, momentum candle patterns & opening candle continuation.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={staggerItem}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group rounded-xl border border-border/50 bg-card/50 p-6 hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.25)] transition-all duration-300 cursor-default"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] transition-all duration-300">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors duration-300">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-16"
          >
            Get Started in <span className="text-primary">3 Steps</span>
          </motion.h2>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {steps.map((s) => (
              <motion.div key={s.step} variants={staggerItem} className="text-center space-y-3">
                <div className="text-4xl font-bold text-primary/30">{s.step}</div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 border-t border-border/30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center space-y-6"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            Ready to decode your <span className="text-primary">edge</span>?
          </h2>
          <p className="text-muted-foreground">
            Start analyzing IB breakouts, momentum candles & OCC patterns with real data. Free.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="text-base px-8 py-6 rounded-full">
            Launch MyOpenEdge
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="MyOpenEdge" className="h-5 w-5 rounded-full object-cover" />
            <span className="font-semibold text-foreground">MyOpenEdge</span>
            <span>· IB, Momentum & OCC Analytics</span>
          </div>
          <p>© 2026 MyOpenEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
