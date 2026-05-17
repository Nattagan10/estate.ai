import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Building2, Plus } from "lucide-react";
import { streamChat, type ChatMsg } from "@/lib/streamChat";
import { toast } from "sonner";
import type { Filters } from "@/lib/filterProperties";

const QUICK = [
  "Find condos near Asok BTS",
  "House near Kasetsart University",
  "Luxury rental in Thonglor under 80k",
  "2 bedroom condo in Ari for sale",
];

export function ChatPanel({
  filters,
  onFiltersChange,
  sessionId,
  onSessionChange,
  onNewChat,
  onTotalChange,
  initialAssistantMessage,
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  sessionId?: string | null;
  onSessionChange?: (id: string | null) => void;
  onNewChat?: () => void;
  onTotalChange?: (n: number) => void;
  initialAssistantMessage?: string;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        initialAssistantMessage ??
        "Hi! I'm **Estate AI**. Tell me about the area, budget or vibe you want and I'll narrow down 500 Bangkok listings instantly.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    let acc = "";
    await streamChat({
      messages: next,
      filters,
      sessionId,
      onFilters: ({ filters: f, total, sessionId: sid }) => {
        onFiltersChange(f);
        onTotalChange?.(total);
        if (sid && sid !== sessionId) onSessionChange?.(sid);
      },
      onDelta: (chunk) => {
        acc += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last?.role === "assistant" &&
            last.content !== undefined &&
            prev.length > next.length
          ) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
          }
          return [...prev, { role: "assistant", content: acc }];
        });
      },
      onDone: () => setBusy(false),
      onError: (err) => {
        setBusy(false);
        toast.error(err);
      },
    });
  };

  return (
    <div
      className="flex h-full flex-col rounded-2xl bg-card border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div
        className="flex items-center gap-3 border-b border-border bg-card px-5 py-4"
        style={{ backgroundImage: "var(--gradient-gloss)" }}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-serif text-base font-semibold text-foreground">Estate AI</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            500 Bangkok listings · MCP-powered filtering
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        {onNewChat && (
          <button
            onClick={onNewChat}
            title="Start a new chat"
            className="ml-2 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground/70 hover:border-accent hover:text-foreground transition"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>

      <div ref={scrollRef} className="chat-scroll flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-strong:text-primary">
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {busy && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm italic text-muted-foreground">
              <span className="typing-ellipsis">typing</span>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-background/50 px-4 py-3">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-accent hover:text-foreground transition"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border bg-card px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about location, budget, lifestyle…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
