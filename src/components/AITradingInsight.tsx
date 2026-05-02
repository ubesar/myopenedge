import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useKnowledge } from "@/hooks/useKnowledge";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

interface AITradingInsightProps {
  mode: "ib" | "momentum" | "occ" | "insidebar" | "outsideday";
  symbol: string;
  analysisData: Record<string, any>;
}

const MODE_LABELS: Record<string, string> = {
  ib: "IB Breakout",
  momentum: "Momentum Candle",
  occ: "OCC",
  insidebar: "Inside Bar",
  outsideday: "Outside Day",
};

function buildPrompt(mode: string, symbol: string, data: Record<string, any>): string {
  const label = MODE_LABELS[mode] || mode;
  return `Berdasarkan data analisis ${label} berikut untuk ${symbol.toUpperCase()}, berikan trading insight singkat dalam bahasa Indonesia (terminologi trading tetap bahasa Inggris).

Data:
${JSON.stringify(data, null, 2)}

Format:
1. **Ringkasan** — rangkum statistik utama (1-2 kalimat)
2. **Edge** — identifikasi edge dari data
3. **Bias** — arah (bullish/bearish/neutral) berdasarkan data terakhir
4. **Catatan** — peringatan singkat

Maksimal 120 kata. Padat & actionable.`;
}

async function streamChat(
  prompt: string,
  onChunk: (text: string) => void,
  signal: AbortSignal,
  customKnowledge?: string
): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      customKnowledge,
    }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err || `HTTP ${resp.status}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No reader");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);
      } catch {
        // skip malformed
      }
    }
  }
}

const AITradingInsight = ({ mode, symbol, analysisData }: AITradingInsightProps) => {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const generatedKeyRef = useRef("");
  const { knowledgeText } = useKnowledge();

  const generateInsight = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setInsight("");

    try {
      const prompt = buildPrompt(mode, symbol, analysisData);
      let accumulated = "";

      await streamChat(
        prompt,
        (chunk) => {
          accumulated += chunk;
          setInsight(accumulated);
        },
        controller.signal,
        knowledgeText || undefined
      );
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("AI Insight error:", err);
      setInsight("Gagal menghasilkan insight. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [mode, symbol, analysisData, knowledgeText]);

  // Auto-generate when mode+symbol changes
  useEffect(() => {
    const key = `${mode}-${symbol}`;
    if (generatedKeyRef.current !== key) {
      generatedKeyRef.current = key;
      generateInsight();
    }
    return () => abortRef.current?.abort();
  }, [mode, symbol, generateInsight]);

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
              ai trading insight
            </span>
            <span className="text-[10px] text-muted-foreground ml-2">
              {MODE_LABELS[mode]} · {symbol.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
                  {loading && (
                    <span className="inline-block w-1.5 h-3.5 bg-primary/60 animate-pulse ml-0.5 align-middle" />
                  )}
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
