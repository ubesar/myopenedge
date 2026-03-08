import { useState, useRef, useEffect, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, TrendingUp, Target, Layers, BookOpen, Share2, Zap, BarChart3, Trash2, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import AppNavSidebar from "@/components/AppNavSidebar";
import type { AnalysisContext, ConfluenceData } from "@/components/AIChatAssistant";

type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const AIAssistant = () => {
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const streamAI = useCallback(async (allMessages: Message[]) => {
    setIsLoading(true);
    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
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

    await streamAI([...messages, userMsg]);
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const quickActions = [
    {
      label: "Pre-Market Briefing",
      icon: Zap,
      description: "Generate a briefing for today's NY Open session",
      prompt: "Create a pre-market briefing for today's NY Open session. Based on historical patterns, analyze:\n1. Inside Bar probability based on yesterday's pattern\n2. Average IB range for today\n3. Key levels to watch\n4. Strategy recommendation (trend vs range)",
    },
    {
      label: "Bias Analysis",
      icon: TrendingUp,
      description: "Analyze directional bias from historical data",
      prompt: "Explain how to analyze directional bias using IB, Momentum, and OCC data. Provide a step-by-step framework I can use daily before trading.",
    },
    {
      label: "Confluence Check",
      icon: Layers,
      description: "Cross-check multiple analysis modes",
      prompt: "Explain the concept of confluence in trading and how to use MyOpenEdge to confirm signals from IB, Momentum, OCC, and Inside Bar simultaneously. Provide examples of high-probability vs conflicting signal scenarios.",
    },
    {
      label: "Trading Plan",
      icon: Target,
      description: "Create a structured trading plan",
      prompt: "Create an ideal trading plan template for a day trader/scalper during the NY Open session. Include:\n- Pre-market checklist\n- Entry criteria based on IB/Momentum/OCC\n- Stop loss & target rules\n- Risk management per trade\n- Journaling template",
    },
    {
      label: "Journal Template",
      icon: BookOpen,
      description: "Format trades for your journal",
      prompt: "Show me an ideal trading journal template for scalpers using MyOpenEdge. Include formats for:\n- Setup entry (ticker, bias, statistical edge)\n- Execution (entry, SL, TP, R:R)\n- Post-trade review (grade, lesson learned)\n- Weekly summary template",
    },
    {
      label: "Export Summary",
      icon: Share2,
      description: "Generate shareable summaries",
      prompt: "Explain the export formats available in MyOpenEdge:\n1. JOURNAL format (full markdown)\n2. SOCIAL format (concise for community/social media)\n3. EA/JSON format (for Expert Advisor)\n\nProvide an example of each format.",
    },
  ];

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/30">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bot className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground">AI Trading Assistant</h1>
            <p className="text-[11px] text-muted-foreground">Quantitative analysis · Risk management · Trade planning</p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 py-12">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Bot className="h-7 w-7 text-primary opacity-60" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">How can I help you trade smarter?</h2>
              <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                Ask me about analysis strategies, get pre-market briefings, create trading plans, or format journal entries.
              </p>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-border/70 transition-all text-left group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <action.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{action.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{action.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border/30 text-card-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>li]:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-card border border-border/30">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick actions bar when in conversation */}
        {messages.length > 0 && !isLoading && (
          <div className="px-6 py-2 border-t border-border/20">
            <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pb-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/30 bg-muted/20 hover:bg-muted/50 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-border/30 bg-card/30">
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="max-w-3xl mx-auto flex gap-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about trading strategies, analysis, or get a pre-market briefing..."
              className="flex-1 bg-muted/50 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="h-[46px] px-5 rounded-xl">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2 max-w-3xl mx-auto">
            AI provides historical probabilities only — not financial advice. Always apply strict risk management.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
