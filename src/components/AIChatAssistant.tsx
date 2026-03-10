import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, TrendingUp, Target, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

export interface AnalysisContext {
  mode: "ib" | "momentum" | "occ" | "gapfill" | null;
  symbol: string;
  summary: string;
}

interface AIChatAssistantProps {
  analysisContext?: AnalysisContext;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const AIChatAssistant = ({ analysisContext }: AIChatAssistantProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          analysisContext: analysisContext?.mode ? analysisContext : undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        toast.error(err.error || "AI request failed");
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
  };

  const hasContext = analysisContext?.mode;

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
        <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-40px)] h-[500px] max-h-[calc(100vh-100px)] rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/30">
            <Bot className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-card-foreground flex-1">AI Trading Assistant</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Analysis context indicator */}
          {hasContext && (
            <div className="px-4 py-1.5 bg-primary/5 border-b border-border/20 text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Analyzing <span className="font-semibold text-card-foreground">{analysisContext.symbol}</span> · {analysisContext.mode?.toUpperCase()} mode
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-xs mt-6 space-y-3">
                <Bot className="h-8 w-8 mx-auto opacity-40" />
                <p>
                  {hasContext
                    ? `I have your ${analysisContext.mode?.toUpperCase()} analysis data for ${analysisContext.symbol}. Ask me for insights!`
                    : "Ask me about IB analysis, momentum patterns, OCC confirmation, or any trading concept."}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                  {[
                    { label: "Analyze bias", icon: TrendingUp, prompt: hasContext ? `Based on the current ${analysisContext.mode?.toUpperCase()} data for ${analysisContext.symbol}, what is the directional bias? Which side has the statistical edge?` : "Explain how to analyze directional bias using IB data." },
                    { label: "Trading plan", icon: Target, prompt: hasContext ? `Create a trading plan for ${analysisContext.symbol} based on the current ${analysisContext.mode?.toUpperCase()} analysis data. Include entry triggers, stop loss, and targets.` : "How do I create a trading plan using IB and momentum analysis?" },
                    { label: "Key levels", icon: BarChart3, prompt: hasContext ? `What are the key levels and probabilities I should watch for ${analysisContext.symbol} based on the ${analysisContext.mode?.toUpperCase()} data?` : "What are the key levels to watch in IB analysis?" },
                  ].map((qp) => (
                    <button
                      key={qp.label}
                      onClick={() => { setInput(qp.prompt); }}
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

          {/* Input */}
          <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={hasContext ? `Ask about ${analysisContext.symbol} ${analysisContext.mode}...` : "Ask about trading analysis..."}
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
};

export default AIChatAssistant;
