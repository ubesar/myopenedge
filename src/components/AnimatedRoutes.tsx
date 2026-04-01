import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "./PageTransition";
import Landing from "@/pages/Landing";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import Upgrade from "@/pages/Upgrade";
import Docs from "@/pages/Docs";
import AIAssistant from "@/pages/AIAssistant";
import Algos from "@/pages/Algos";
import Chart from "@/pages/Chart";
import Watchlist from "@/pages/Watchlist";
import NotFound from "@/pages/NotFound";
import TermsConditions from "@/pages/TermsConditions";
import PaddleLiveGuide from "@/pages/PaddleLiveGuide";
import ResetPassword from "@/pages/ResetPassword";
import WhatsInPlay from "@/pages/WhatsInPlay";
import Journal from "@/pages/Journal";
import AdminPanel from "@/pages/AdminPanel";

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/app" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/ai-assistant" element={<PageTransition><AIAssistant /></PageTransition>} />
        <Route path="/algos" element={<PageTransition><Algos /></PageTransition>} />
        <Route path="/chart" element={<PageTransition><Chart /></PageTransition>} />
        <Route path="/watchlist" element={<PageTransition><Watchlist /></PageTransition>} />
        <Route path="/whats-in-play" element={<PageTransition><WhatsInPlay /></PageTransition>} />
        <Route path="/journal" element={<PageTransition><Journal /></PageTransition>} />
        <Route path="/upgrade" element={<PageTransition><Upgrade /></PageTransition>} />
        <Route path="/docs" element={<PageTransition><Docs /></PageTransition>} />
        <Route path="/docs/paddle-guide" element={<PageTransition><PaddleLiveGuide /></PageTransition>} />
        <Route path="/terms_conditions" element={<PageTransition><TermsConditions /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/admin-x9k7-88f2-vqp9" element={<PageTransition><AdminPanel /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

export default AnimatedRoutes;
