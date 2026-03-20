import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

interface AITradingInsightProps {
  mode: "ib" | "momentum" | "occ" | "insidebar";
  symbol: string;
  analysisData: Record<string, any>;
}

const MODE_LABELS: Record<string, string> = {
  ib: "IB Breakout",
  momentum: "Momentum Candle",
  occ: "OCC",
  insidebar: "Inside Bar",
};

function buildPrompt(mode: string, symbol: string, data: Record<string, any>): string {
  const label = MODE_LABELS[mode] || mode;
  return `Kamu adalah elite quantitative trading assistant. Berdasarkan data analisis ${label} berikut untuk ${symbol.toUpperCase()}, berikan trading insight singkat dalam bahasa Indonesia (terminologi trading tetap bahasa Inggris).

Data analisis:
${JSON.stringify(data, null, 2)}

Format jawaban:
1. **Ringkasan** — rangkum statistik utama dalam 1-2 kalimat
2. **Edge** — identifikasi edge/keunggulan yang terlihat dari data
3. **Bias Hari Ini** — berikan bias arah (bullish/bearish/neutral) berdasarkan data terakhir jika tersedia
4. **Catatan** — peringatan atau hal yang perlu diperhatikan

Jawab singkat, padat, dan actionable. Maksimal 150 kata.`;
}

const AITradingInsight = ({ mode, symbol, analysisData }: AITradingInsightProps) => {
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateInsight = useCallback(async () => {
    setLoading(true);
    setInsight("");

    try {
      const prompt = buildPrompt(mode, symbol, analysisData);

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{ role: "user", content: prompt }],
        },
      });

      if (error) throw error;

      // Handle streaming response or direct response
      if (typeof data === "string") {
        setInsight(data);
      } else if (data?.choices?.[0]?.message?.content) {
        setInsight(data.choices[0].message.content);
      } else if (data?.reply) {
        setInsight(data.reply);
      } else {
        setInsight("Tidak dapat menghasilkan insight saat ini.");
      }
      setHasGenerated(true);
    } catch (err: any) {
      console.error("AI Insight error:", err);
      setInsight("Gagal menghasilkan insight. Silakan coba lagi.");
      setHasGenerated(true);
    } finally {
      setLoading(false);
    }
  }, [mode, symbol, analysisData]);

  // Auto-generate on mount
  useEffect(() => {
    if (!hasGenerated) {
      generateInsight();
    }
  }, [mode, symbol]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="border border-border rounded-xl bg-card overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-[12px] font-semibold text-foreground">
              AI Trading Insight
            </span>
            <span className="text-[10px] text-muted-foreground ml-2">
              {MODE_LABELS[mode]} · {symbol.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasGenerated && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                generateInsight();
              }}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Regenerate"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-border/50">
              {loading && !insight ? (
                <div className="py-6 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">menganalisis data…</p>
                </div>
              ) : (
                <div className="pt-3 prose prose-sm prose-invert max-w-none [&_p]:text-[12px] [&_p]:leading-relaxed [&_p]:text-foreground/80 [&_strong]:text-foreground [&_li]:text-[12px] [&_li]:text-foreground/80 [&_ol]:pl-4 [&_ul]:pl-4 [&_h1]:text-[13px] [&_h2]:text-[13px] [&_h3]:text-[12px]">
                  <ReactMarkdown>{insight}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AITradingInsight;
