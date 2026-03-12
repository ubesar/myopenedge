import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, X, Send, Bot, User, Loader2, TrendingUp, Target, BarChart3, Layers, BookOpen, Share2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

export interface AnalysisContext {
  mode: "ib" | "momentum" | "occ" | "gapfill" | "insidebar" | null;
  symbol: string;
  summary: string;
}

export interface ConfluenceData {
  [mode: string]: { symbol: string; summary: string };
}

export interface AIChatAssistantHandle {
  triggerAutoSummary: (context: AnalysisContext) => void;
}

interface AIChatAssistantProps {
  analysisContext?: AnalysisContext;
  confluenceData?: ConfluenceData;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const AIChatAssistant = forwardRef<AIChatAssistantHandle, AIChatAssistantProps>(
  ({ analysisContext, confluenceData }, ref) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages, open]);

    const streamAI = useCallback(async (allMessages: Message[], context?: AnalysisContext, confluence?: ConfluenceData) => {
      setIsLoading(true);
      let assistantSoFar = "";

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
          toast.error("Please log in to use the AI Assistant.");
          setIsLoading(false);
          return;
        }

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: allMessages,
            analysisContext: context?.mode ? context : undefined,
            confluenceData: confluence && Object.keys(confluence).length > 1 ? confluence : undefined,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Request failed" }));
          if (resp.status === 429) toast.error("Rate limit exceeded. Please try again later.");
          else if (resp.status === 402) toast.error("AI credits exhausted. Please add credits.");
          else toast.error(err.error || "AI request failed");
          setIsLoading(false);
          return;
        }

        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") { streamDone = true; break; }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                const snapshot = assistantSoFar;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
                  }
                  return [...prev, { role: "assistant", content: snapshot }];
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to connect to AI assistant");
      } finally {
        setIsLoading(false);
      }
    }, []);

    const send = async () => {
      const text = input.trim();
      if (!text || isLoading) return;

      const userMsg: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      const allMessages = [...messages, userMsg];
      await streamAI(allMessages, analysisContext, confluenceData);
    };

    // Auto-summary: triggered externally after analysis completes
    const triggerAutoSummary = useCallback((context: AnalysisContext) => {
      if (!context.mode || isLoading) return;
      setOpen(true);

      const autoPrompt = `Analysis just completed. Provide an automatic summary in 3-5 sentences: directional bias, confidence level, and key levels to watch. Data: ${context.summary}`;
      const systemMsg: Message = { role: "user", content: autoPrompt };
      setMessages((prev) => [...prev, systemMsg]);

      const allMessages = [...messages, systemMsg];
      streamAI(allMessages, context, confluenceData);
    }, [messages, isLoading, streamAI, confluenceData]);

    useImperativeHandle(ref, () => ({ triggerAutoSummary }), [triggerAutoSummary]);

    const hasContext = analysisContext?.mode;
    const hasConfluence = confluenceData && Object.keys(confluenceData).length > 1;

    const quickActions = [
      {
        label: "Auto Summary",
        icon: Zap,
        prompt: hasContext
          ? `Provide a brief 3-5 sentence summary of the ${analysisContext?.mode?.toUpperCase()} data for ${analysisContext?.symbol}. Include: directional bias, confidence level, and key levels.`
          : "Explain how to read an IB analysis summary.",
        show: true,
      },
      {
        label: "Confluence",
        icon: Layers,
        prompt: hasConfluence
          ? `Perform a confluence analysis from all the following data and determine whether signals ALIGN or CONFLICT:\n${Object.entries(confluenceData!).map(([mode, d]) => `- ${mode.toUpperCase()}: ${d.summary}`).join("\n")}\n\nIf aligned, declare this a High Probability Setup. If conflicting, recommend sitting on hands.`
          : "Explain the concept of confluence in trading and why it's important to confirm signals from multiple indicators.",
        show: true,
      },
      {
        label: "Trade Plan",
        icon: Target,
        prompt: hasContext
          ? `Create a trading plan for ${analysisContext?.symbol} based on the current ${analysisContext?.mode?.toUpperCase()} data. Include: entry trigger, stop loss, profit target, and R:R ratio. Format for trading journal.`
          : "How do I create a trading plan using IB and momentum data?",
        show: true,
      },
      {
        label: "Journal Entry",
        icon: BookOpen,
        prompt: hasContext
          ? `Format the ${analysisContext?.mode?.toUpperCase()} analysis data for ${analysisContext?.symbol} into a standard trading journal template with format:\n- Date & Ticker\n- Bias: (Long/Short/Neutral)\n- Statistical Edge: (percentage)\n- Setup Grade: (A/B/C based on probability)\n- Key Levels\n- Risk Management Notes`
          : "Show me an ideal trading journal template for scalpers.",
        show: true,
      },
      {
        label: "Export",
        icon: Share2,
        prompt: hasContext
          ? `Create 3 summary versions for ${analysisContext?.symbol} ${analysisContext?.mode?.toUpperCase()} data:\n\n1. **JOURNAL** (full markdown with all details)\n2. **SOCIAL** (concise 2-3 line format for sharing in communities)\n3. **EA/JSON** (structured JSON format for Expert Advisor)`
          : "Explain useful export formats for a trading journal.",
        show: true,
      },
      {
        label: "Bias Analysis",
        icon: TrendingUp,
        prompt: hasContext
          ? `Based on the ${analysisContext?.mode?.toUpperCase()} data for ${analysisContext?.symbol}, what is today's directional bias? Which side has the statistical edge? Provide specific percentages.`
          : "Explain how to analyze directional bias using IB data.",
        show: true,
      },
    ];

    return (
      <>
        {/* FAB */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        )}

        {/* Chat Panel */}
        {open && (
          <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-40px)] h-[540px] max-h-[calc(100vh-100px)] rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/30">
              <Bot className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-card-foreground block">AI Trading Assistant</span>
                <span className="text-[9px] text-primary/80 font-medium">⚡ Gemini 3 Flash</span>
              </div>
              {hasConfluence && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                  {Object.keys(confluenceData!).length} modes
                </span>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Analysis context indicator */}
            {hasContext && (
              <div className="px-4 py-1.5 bg-primary/5 border-b border-border/20 text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Analyzing <span className="font-semibold text-card-foreground">{analysisContext!.symbol}</span> · {analysisContext!.mode?.toUpperCase()} mode
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-xs mt-4 space-y-3">
                  <Bot className="h-8 w-8 mx-auto opacity-40" />
                  <p className="px-2">
                    {hasContext
                      ? `Data ${analysisContext!.mode?.toUpperCase()} untuk ${analysisContext!.symbol} tersedia. Pilih aksi cepat atau tanya apapun!`
                      : "Jalankan analisis terlebih dahulu, atau tanya tentang konsep trading."}
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {quickActions.filter(a => a.show).slice(0, 4).map((qp) => (
                      <button
                        key={qp.label}
                        onClick={() => setInput(qp.prompt)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-border/40 bg-muted/30 hover:bg-muted/60 text-[11px] text-card-foreground transition-colors"
                      >
                        <qp.icon className="h-3 w-3 text-primary" />
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-card-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-muted/50">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions bar when messages exist */}
            {messages.length > 0 && !isLoading && (
              <div className="px-3 py-1.5 border-t border-border/20 overflow-x-auto">
                <div className="flex gap-1.5">
                  {quickActions.filter(a => a.show).map((qp) => (
                    <button
                      key={qp.label}
                      onClick={() => setInput(qp.prompt)}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border border-border/30 bg-muted/20 hover:bg-muted/50 text-[10px] text-muted-foreground hover:text-card-foreground transition-colors"
                    >
                      <qp.icon className="h-2.5 w-2.5" />
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
              <form
                onSubmit={(e) => { e.preventDefault(); send(); }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={hasContext ? `Ask about ${analysisContext!.symbol} ${analysisContext!.mode}...` : "Ask about trading analysis..."}
                  className="flex-1 bg-muted/50 border border-border/30 rounded-lg px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  disabled={isLoading}
                />
                <Button type="submit" size="sm" disabled={isLoading || !input.trim()} className="h-9 w-9 p-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }
);

AIChatAssistant.displayName = "AIChatAssistant";

export default AIChatAssistant;
