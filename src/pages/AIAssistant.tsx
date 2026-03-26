import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, TrendingUp, Target, Layers, BookOpen, Share2, Zap, Trash2, Lock, Crown, Activity, Database } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import AppNavSidebar, { MobileHeader } from "@/components/AppNavSidebar";
import { useAIAnalysis, type ToolCallArgs } from "@/hooks/useAIAnalysis";
import KnowledgeManager from "@/components/KnowledgeManager";
import { useKnowledge } from "@/hooks/useKnowledge";

type Message = { role: "user" | "assistant" | "tool"; content: string; tool_call_id?: string; name?: string };

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface AssistantToolCallMessage {
  role: "assistant";
  content: string | null;
  tool_calls: ToolCall[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const AIAssistant = () => {
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { executeAnalysis } = useAIAnalysis();
  const { knowledgeText, refreshKnowledge } = useKnowledge();
  const [showKnowledge, setShowKnowledge] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, statusText]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getAccessToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Stream AI and handle tool calls
  const streamAI = useCallback(async (allMessages: Message[]): Promise<void> => {
    setIsLoading(true);
    setStatusText("");

    const accessToken = await getAccessToken();
    if (!accessToken) {
      toast.error("Please log in to use the AI Assistant.");
      setIsLoading(false);
      return;
    }

    try {
      await doStreamRound(allMessages, accessToken);
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to AI assistant");
    } finally {
      setIsLoading(false);
      setStatusText("");
    }
  }, [executeAnalysis]);

  const doStreamRound = async (allMessages: Message[], accessToken: string): Promise<void> => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages: allMessages, enableTools: true, customKnowledge: knowledgeText || undefined }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Request failed" }));
      if (resp.status === 429) toast.error("Rate limit exceeded. Please try again later.");
      else if (resp.status === 402) toast.error("AI credits exhausted. Please add credits.");
      else toast.error(err.error || "AI request failed");
      return;
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let assistantSoFar = "";
    let accumulatedToolCalls: Record<number, { id: string; functionName: string; args: string }> = {};
    let finishReason = "";

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
          const choice = parsed.choices?.[0];
          if (!choice) continue;

          // Track finish reason
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const delta = choice.delta;
          if (!delta) continue;

          // Handle content
          if (delta.content) {
            assistantSoFar += delta.content;
            const snapshot = assistantSoFar;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && !('tool_calls' in last)) {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
              }
              return [...prev, { role: "assistant", content: snapshot }];
            });
          }

          // Handle tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!accumulatedToolCalls[idx]) {
                accumulatedToolCalls[idx] = { id: tc.id || "", functionName: "", args: "" };
              }
              if (tc.id) accumulatedToolCalls[idx].id = tc.id;
              if (tc.function?.name) accumulatedToolCalls[idx].functionName += tc.function.name;
              if (tc.function?.arguments) accumulatedToolCalls[idx].args += tc.function.arguments;
            }
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // If the AI requested tool calls, execute them and continue
    if (finishReason === "tool_calls" && Object.keys(accumulatedToolCalls).length > 0) {
      const toolCalls: ToolCall[] = Object.values(accumulatedToolCalls).map((tc) => ({
        id: tc.id,
        function: { name: tc.functionName, arguments: tc.args },
      }));

      // Build the assistant message with tool_calls for conversation history
      const assistantToolMsg: AssistantToolCallMessage = {
        role: "assistant",
        content: assistantSoFar || null,
        tool_calls: toolCalls,
      };

      // Execute each tool call
      const toolResultMessages: Message[] = [];
      for (const tc of toolCalls) {
        try {
          const args: ToolCallArgs = JSON.parse(tc.function.arguments);
          setStatusText(`⏳ analyzing ${args.symbol} (${args.mode.toUpperCase()})...`);

          const result = await executeAnalysis(args);
          toolResultMessages.push({
            role: "tool",
            content: result,
            tool_call_id: tc.id,
            name: tc.function.name,
          });
        } catch (err: any) {
          toolResultMessages.push({
            role: "tool",
            content: JSON.stringify({ error: err.message || "Tool execution failed" }),
            tool_call_id: tc.id,
            name: tc.function.name,
          });
        }
      }

      setStatusText("🧠 interpreting results...");

      // Send results back to AI for interpretation
      const updatedMessages = [...allMessages, assistantToolMsg as any, ...toolResultMessages];
      await doStreamRound(updatedMessages, accessToken);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Only send user+assistant messages (not tool messages) in visible history
    const allMessages = [...messages, userMsg];
    await streamAI(allMessages);
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isActive) {
    return (
      <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
        {isMobile && <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="ai assistant" />}
        {!isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
        {isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-xl border border-primary/20 bg-card/80 backdrop-blur-sm p-10 text-center max-w-md">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Pro Feature</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              AI Trading Assistant is exclusively available for Pro members. Upgrade to get full access.
            </p>
            <Button onClick={() => navigate("/upgrade")} size="lg" className="gap-2">
              <Crown className="h-4 w-4" /> Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      label: "IB Single Break Edge",
      icon: TrendingUp,
      description: "73-80% single break on NQ — trade continuation, bukan reversal",
      prompt: "Jalankan analisis IB untuk NQ menggunakan 60 hari trading. Fokus pada probabilitas single break vs double break vs no break. Apakah sejalan dengan benchmark Edgeful (single break ~73-80%)? Jika single break terjadi, berikan directional bias berdasarkan 'The Tell' (high/low formed first).",
    },
    {
      label: "OCC Continuation Bias",
      icon: Activity,
      description: "First candle predicts daily close ~70-75% of the time",
      prompt: "Jalankan analisis OCC untuk NQ menggunakan 60 hari trading dengan opening candle 30m. Berapa persen green opening candle diikuti green day (continuation)? Berapa persen red opening candle diikuti red day? Bandingkan dengan benchmark Edgeful (~70-75% continuation rate).",
    },
    {
      label: "Gap Size & Fill Rate",
      icon: Zap,
      description: "Small gap fill 83-93%, large gap rarely fills — size matters",
      prompt: "Jalankan analisis Gap Fill untuk NQ menggunakan 120 hari trading. Fokus pada gap size breakdown: seberapa sering gap kecil (<0.2%) vs gap besar (>0.6%) terisi? Bandingkan dengan data Edgeful. Berikan juga 'by close' analysis — setelah gap fill, apakah session close green atau red?",
    },
    {
      label: "3 Powerful Reports",
      icon: Layers,
      description: "OCC + IB + Gap Fill = confluence strategy ala Edgeful",
      prompt: "Jalankan analisis OCC, IB, dan Gap Fill untuk NQ menggunakan 60 hari trading. Terapkan strategi '3 Powerful Reports' dari Edgeful: 1) Cek OCC untuk directional bias, 2) Cek IB single break direction, 3) Cek gap fill probability. Jika ketiga sinyal ALIGN, state 'HIGH PROBABILITY SETUP'. Jika conflict, state 'PROTECT CAPITAL'.",
    },
    {
      label: "Inside Bar Breakout",
      icon: Target,
      description: "Rare pattern (~22%) tapi 78% break previous range",
      prompt: "Jalankan analisis Inside Bar untuk SPY menggunakan 120 hari trading. Berapa occurrence rate-nya? Ketika inside bar terbentuk, berapa persen break upside vs downside? Bandingkan dengan benchmark Edgeful (~78% break rate, ~52% upside). Berikan trading plan: entry on 30min breakout, target previous day's high/low.",
    },
    {
      label: "Outside Day Reversal",
      icon: Share2,
      description: "Open di luar range kemarin — retrace or continue?",
      prompt: "Jalankan analisis Outside Day untuk NQ menggunakan 120 hari trading. Berapa persen bullish outside day (open > yesterday's high) yang retrace ke prior high? Berapa persen bearish outside day yang retrace ke prior low? Bandingkan dengan Edgeful (~65% bullish retrace, ~58% bearish retrace). Analisis juga berdasarkan gap size — apakah gap kecil lebih sering fill?",
    },
  ];

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {isMobile && <MobileHeader onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)} title="ai assistant" />}
      {!isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
      {isMobile && <AppNavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-border/30">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[13px] sm:text-sm font-semibold text-foreground">AI Trading Assistant</h1>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <p className="text-[10px] sm:text-[11px] text-muted-foreground hidden sm:block">live analysis · confluence detection · trade planning</p>
              <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium border border-primary/20">⚡ gemini 3 flash</span>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              className="text-muted-foreground hover:text-foreground text-xs gap-1 px-2 sm:px-3"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6 py-8 sm:py-12">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 sm:mb-5">
                <Bot className="h-6 w-6 sm:h-7 sm:w-7 text-primary opacity-60" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-1">apa yang bisa saya bantu hari ini?</h2>
              <p className="text-[12px] sm:text-sm text-muted-foreground mb-6 sm:mb-8 text-center max-w-md">
                saya bisa menjalankan live analysis, menggabungkan beberapa mode untuk confluence, dan membuat trading plan berbasis data.
              </p>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 max-w-3xl w-full">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-border/70 transition-all text-left group"
                  >
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <action.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] sm:text-[13px] font-medium text-foreground">{action.label}</p>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
              {messages.filter(m => m.role !== "tool").map((msg, i) => (
                <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-[13px] sm:text-sm leading-relaxed max-w-[90%] sm:max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border/30 text-card-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>li]:text-[13px] sm:[&>li]:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 sm:gap-3">
                  <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  </div>
                  <div className="rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 bg-card border border-border/30 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {statusText && (
                      <span className="text-[11px] sm:text-xs text-muted-foreground">{statusText}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick actions bar when in conversation */}
        {messages.length > 0 && !isLoading && (
          <div className="px-3 sm:px-6 py-2 border-t border-border/20">
            <div className="max-w-3xl mx-auto flex gap-1.5 sm:gap-2 overflow-x-auto pb-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border border-border/30 bg-muted/20 hover:bg-muted/50 text-[10px] sm:text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-border/30 bg-card/30">
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="max-w-3xl mx-auto flex gap-2 sm:gap-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="contoh: 'analisis IB dan OCC untuk QQQ 60 hari'"
              className="flex-1 min-w-0 bg-muted/50 border border-border/40 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-[13px] sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="h-[42px] sm:h-[46px] px-4 sm:px-5 rounded-xl shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center mt-1.5 sm:mt-2 max-w-3xl mx-auto">
            AI mengambil data live & menjalankan analisis nyata — bukan saran keuangan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
