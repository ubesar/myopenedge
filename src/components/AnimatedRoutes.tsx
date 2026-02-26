import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
import PageTransition from "./PageTransition";
import Landing from "@/pages/Landing";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import Upgrade from "@/pages/Upgrade";
import NotFound from "@/pages/NotFound";
import { AccountProvider } from "@/hooks/useAccounts";

const JournalDashboard = lazy(() => import("@/pages/journal/JournalDashboard"));
const JournalTrades = lazy(() => import("@/pages/journal/JournalTrades"));
const JournalTradeDetail = lazy(() => import("@/pages/journal/JournalTradeDetail"));
const JournalAnalytics = lazy(() => import("@/pages/journal/JournalAnalytics"));
const JournalPlaybooks = lazy(() => import("@/pages/journal/JournalPlaybooks"));
const JournalImport = lazy(() => import("@/pages/journal/JournalImport"));
const JournalSettings = lazy(() => import("@/pages/journal/JournalSettings"));

function JournalWrapper({ children }: { children: React.ReactNode }) {
  return <AccountProvider>{children}</AccountProvider>;
}

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/app" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/upgrade" element={<PageTransition><Upgrade /></PageTransition>} />
        <Route path="/journal" element={<PageTransition><Suspense fallback={null}><JournalWrapper><JournalDashboard /></JournalWrapper></Suspense></PageTransition>} />
        <Route path="/journal/trades" element={<PageTransition><Suspense fallback={null}><JournalWrapper><JournalTrades /></JournalWrapper></Suspense></PageTransition>} />
        <Route path="/journal/trades/:id" element={<PageTransition><Suspense fallback={null}><JournalWrapper><JournalTradeDetail /></JournalWrapper></Suspense></PageTransition>} />
        <Route path="/journal/analytics" element={<PageTransition><Suspense fallback={null}><JournalWrapper><JournalAnalytics /></JournalWrapper></Suspense></PageTransition>} />
        <Route path="/journal/playbooks" element={<PageTransition><Suspense fallback={null}><JournalWrapper><JournalPlaybooks /></JournalWrapper></Suspense></PageTransition>} />
        <Route path="/journal/import" element={<PageTransition><Suspense fallback={null}><JournalWrapper><JournalImport /></JournalWrapper></Suspense></PageTransition>} />
        <Route path="/journal/settings" element={<PageTransition><Suspense fallback={null}><JournalWrapper><JournalSettings /></JournalWrapper></Suspense></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

export default AnimatedRoutes;
