import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import TradingViewChart from "@/components/TradingViewChart";
import { useIsMobile } from "@/hooks/use-mobile";

const intervals = [
  { label: "5m", value: "5min" },
  { label: "15m", value: "15min" },
  { label: "30m", value: "30min" },
  { label: "1h", value: "1h" },
];

const popularSymbols = ["QQQ", "SPY", "AAPL", "TSLA", "NVDA", "AMZN", "MSFT", "META"];

const Chart = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(true);
  const [symbol, setSymbol] = useState("QQQ");
  const [symbolInput, setSymbolInput] = useState("QQQ");
  const [interval, setInterval] = useState("5min");
  const [showIB, setShowIB] = useState(true);
  const [showMC, setShowMC] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) return null;
  if (!user) return null;

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = symbolInput.trim().toUpperCase();
    if (trimmed) setSymbol(trimmed);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full overflow-hidden" style={{ background: "#131722" }}>
      {isMobile && (
        <MobileHeader onMenuToggle={() => setCollapsed(!collapsed)} title="chart" />
      )}
      {!isMobile && <AppNavSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />}
      {isMobile && <AppNavSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b overflow-x-auto" style={{ borderColor: "rgba(42,46,57,0.5)", background: "#1E222D" }}>
          <form onSubmit={handleSymbolSubmit} className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              className="w-20 px-2 py-1 text-[13px] font-semibold rounded text-white border-none outline-none"
              style={{ background: "#2A2E39" }}
            />
          </form>

          <div className="flex items-center gap-0.5 ml-1 shrink-0">
            {popularSymbols.map((s) => (
              <button
                key={s}
                onClick={() => { setSymbol(s); setSymbolInput(s); }}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  symbol === s ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
                style={symbol === s ? { background: "#2962FF" } : {}}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="h-5 w-px mx-1 shrink-0" style={{ background: "#2A2E39" }} />

          <div className="flex items-center gap-0.5 shrink-0">
            {intervals.map((i) => (
              <button
                key={i.value}
                onClick={() => setInterval(i.value)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  interval === i.value ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
                style={interval === i.value ? { background: "#2962FF" } : {}}
              >
                {i.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px mx-1 shrink-0" style={{ background: "#2A2E39" }} />

          <button
            onClick={() => setShowIB(!showIB)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
              showIB ? "text-white" : "text-gray-500 hover:text-gray-300"
            }`}
            style={showIB ? { background: "#2962FF" } : {}}
          >
            IB
          </button>

          <button
            onClick={() => setShowMC(!showMC)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
              showMC ? "text-white" : "text-gray-500 hover:text-gray-300"
            }`}
            style={showMC ? { background: "#2962FF" } : {}}
          >
            MC
          </button>

        </div>

        <div className="flex-1 min-h-0">
          <TradingViewChart symbol={symbol} interval={interval} showIB={showIB} showMC={showMC} />
        </div>
      </div>
    </div>
  );
};

export default Chart;
