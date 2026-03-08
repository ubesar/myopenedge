import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppNavSidebar from "@/components/AppNavSidebar";
import TradingViewChart from "@/components/TradingViewChart";

const intervals = [
  { label: "1m", value: "1min" },
  { label: "5m", value: "5min" },
  { label: "15m", value: "15min" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1day" },
];

const popularSymbols = ["QQQ", "SPY", "AAPL", "TSLA", "NVDA", "AMZN", "MSFT", "META"];

const Chart = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [symbol, setSymbol] = useState("QQQ");
  const [symbolInput, setSymbolInput] = useState("QQQ");
  const [interval, setInterval] = useState("5min");

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
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "#131722" }}>
      <AppNavSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: "rgba(42,46,57,0.5)", background: "#1E222D" }}>
          {/* Symbol input */}
          <form onSubmit={handleSymbolSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              className="w-20 px-2 py-1 text-[13px] font-semibold rounded text-white border-none outline-none"
              style={{ background: "#2A2E39" }}
            />
          </form>

          {/* Quick symbols */}
          <div className="flex items-center gap-0.5 ml-1">
            {popularSymbols.map((s) => (
              <button
                key={s}
                onClick={() => { setSymbol(s); setSymbolInput(s); }}
                className={`px-2 py-1 text-[11px] rounded transition-colors ${
                  symbol === s
                    ? "text-white"
                    : "text-[#787B86] hover:text-[#D1D4DC]"
                }`}
                style={symbol === s ? { background: "#2962FF" } : {}}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-5 mx-2" style={{ background: "rgba(42,46,57,0.8)" }} />

          {/* Interval buttons */}
          <div className="flex items-center gap-0.5">
            {intervals.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setInterval(tf.value)}
                className={`px-2.5 py-1 text-[12px] rounded transition-colors ${
                  interval === tf.value
                    ? "text-white"
                    : "text-[#787B86] hover:text-[#D1D4DC]"
                }`}
                style={interval === tf.value ? { background: "#2962FF" } : {}}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0 h-full">
          <TradingViewChart symbol={symbol} interval={interval} />
        </div>
      </div>
    </div>
  );
};

export default Chart;
