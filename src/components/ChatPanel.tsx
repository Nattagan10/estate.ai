import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Building2, Plus, X, Square, Layers } from "lucide-react";
import { streamChat, ragChat, type ChatMsg, type RagSource } from "@/lib/streamChat";
import type { Filters } from "@/lib/filterProperties";
import type { Property } from "@/data/properties";
import { PROPERTY_TYPE_LABEL } from "@/lib/filterProperties";

function ragSourceToProperty(s: RagSource, idx: number): Property {
  const t = (s.type ?? "").toLowerCase();
  const propertyType: Property["propertyType"] =
    t.includes("condo") || t.includes("apartment") ? "condo"
    : t.includes("townhome") || t.includes("townhouse") ? "townhouse"
    : t.includes("commercial") || t.includes("retail") ? "commercial"
    : t.includes("house") || t.includes("villa") ? "house"
    : "condo";
  const id = s.url ? `rag-${s.url.split("/").pop() ?? idx}` : `rag-${idx}`;
  return {
    id,
    name: s.name ?? "",
    description: [s.type, s.district, s.province].filter(Boolean).join(" · "),
    price: s.price_thb ?? 0,
    listingType: "sale",
    propertyType,
    bedrooms: 0, bathrooms: 0, area: 0,
    area_name: s.district ?? s.province ?? "",
    lat: s.latitude ?? 13.7563,
    lng: s.longitude ?? 100.5018,
    address: [s.district, s.province].filter(Boolean).join(", "),
    image: "",
    availability: "available",
    nearby: [],
    tags: [],
    province: s.province ?? "",
    district: s.district ?? "",
    neighborhood: "",
    developer: "",
    price_per_sqm: 0,
    year_built: 0,
    nbr_floors: 0,
    rental_yield: null,
    near_transit: null,
    url: s.url ?? "",
  };
}

const QUICK = [
  "คอนโดแถวสุขุมวิท งบ 3 ล้าน",
  "บ้านเดี่ยวใกล้เกษตร",
  "เช่าคอนโดใกล้รถไฟฟ้า",
  "ทาวน์เฮ้าส์แถวลาดพร้าว",
  "Find condos near Asok BTS",
  "2 bed condo in Thonglor for sale",
  "Rental condo near BTS under 30k",
  "House in Lat Phrao budget 5M",
];

export function ChatPanel({
  filters,
  onFiltersChange,
  sessionId,
  onSessionChange,
  onNewChat,
  onTotalChange,
  onRagResults,
  initialAssistantMessage,
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  sessionId?: string | null;
  onSessionChange?: (id: string | null) => void;
  onNewChat?: () => void;
  onTotalChange?: (n: number) => void;
  onRagResults?: (properties: Property[]) => void;
  initialAssistantMessage?: string;
}) {
  const [useRag, setUseRag] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const saved = localStorage.getItem("estate_chat_messages");
      if (saved) {
        const parsed: ChatMsg[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [{
      role: "assistant",
      content: initialAssistantMessage ??
        "สวัสดีค่ะ! ฉันคือ **Estate AI**\n\nบอกฉันถึงทำเลที่ต้องการ งบประมาณ หรือไลฟ์สไตล์ที่อยากได้ แล้วฉันจะค้นหาจากรายการ 53,466 อสังหาฯ ในกรุงเทพให้ทันทีค่ะ\n\n*Hi! Tell me the area, budget, or lifestyle you want and I'll search 53,466 Bangkok listings instantly.*",
    }];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [lastUserText, setLastUserText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    try { localStorage.setItem("estate_chat_messages", JSON.stringify(messages)); } catch {}
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setLastUserText(text);
    setHasError(false);
    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    const abort = new AbortController();
    abortRef.current = abort;
    let acc = "";

    const sharedCallbacks = {
      signal: abort.signal,
      onDelta: (chunk: string) => {
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
      onDone: () => { setBusy(false); abortRef.current = null; },
      onError: () => {
        setBusy(false);
        abortRef.current = null;
        setHasError(true);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content?.trim()) {
            // partial response already visible — append interrupted note
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: m.content + "\n\n_ขออภัยค่ะ การตอบกลับถูกขัดจังหวะ กรุณาลองส่งใหม่อีกครั้งนะคะ_" }
                : m
            );
          }
          // no content yet — add fresh error bubble
          return [
            ...prev,
            { role: "assistant" as const, content: "ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองส่งข้อความใหม่อีกครั้งนะคะ" },
          ];
        });
      },
    };

    if (useRag) {
      await ragChat({
        messages: next,
        ...sharedCallbacks,
        onResults: (sources) => {
          onRagResults?.(sources.map((s, i) => ragSourceToProperty(s, i)));
        },
      });
    } else {
      await streamChat({
        messages: next,
        filters,
        sessionId,
        onFilters: ({ filters: f, total, sessionId: sid }) => {
          onFiltersChange(f);
          onTotalChange?.(total);
          if (sid && sid !== sessionId) onSessionChange?.(sid);
        },
        ...sharedCallbacks,
      });
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const activeChips: { label: string; clear: () => void }[] = [];
  if (filters.area)
    activeChips.push({ label: `📍 ${filters.area}`, clear: () => onFiltersChange({ ...filters, area: undefined }) });
  if (filters.propertyType && filters.propertyType !== "Any")
    activeChips.push({ label: PROPERTY_TYPE_LABEL[filters.propertyType], clear: () => onFiltersChange({ ...filters, propertyType: undefined }) });
  if (filters.propertyTypes?.length)
    activeChips.push({ label: filters.propertyTypes.map(t => PROPERTY_TYPE_LABEL[t]).join(", "), clear: () => onFiltersChange({ ...filters, propertyTypes: undefined }) });
  if (filters.maxPrice != null)
    activeChips.push({ label: `≤ ฿${filters.maxPrice.toLocaleString()}`, clear: () => onFiltersChange({ ...filters, maxPrice: undefined }) });
  if (filters.minPrice != null)
    activeChips.push({ label: `≥ ฿${filters.minPrice.toLocaleString()}`, clear: () => onFiltersChange({ ...filters, minPrice: undefined }) });
  if (filters.nearTransit)
    activeChips.push({ label: "🚇 Near BTS/MRT", clear: () => onFiltersChange({ ...filters, nearTransit: undefined }) });

  return (
    <div
      className="flex h-full flex-col rounded-2xl bg-card border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div
        className="flex items-center gap-3 border-b border-border bg-card px-5 py-4"
        style={{ backgroundImage: "var(--gradient-gloss)" }}
      >
        <div className="relative grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shrink-0">
          <Building2 className="h-5 w-5" />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-amber-400 ring-2 ring-card">
            <Sparkles className="h-2.5 w-2.5 text-amber-900" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base font-semibold text-foreground leading-tight">Estate AI</div>
          <div className="text-[11px] text-muted-foreground">Bangkok property assistant</div>
        </div>
        <button
          onClick={() => setUseRag((v) => !v)}
          title={useRag ? "Using bot_reccomend RAG — click to switch to estate.ai" : "Using estate.ai — click to switch to bot_reccomend RAG"}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            useRag
              ? "border-amber-400 bg-amber-400/10 text-amber-600 hover:bg-amber-400/20"
              : "border-border bg-card text-foreground/70 hover:border-accent hover:text-foreground"
          }`}
        >
          <Layers className="h-3 w-3" />
          {useRag ? "RAG" : "AI"}
        </button>
        {onNewChat && (
          <button
            onClick={onNewChat}
            title="Start a new chat"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground/70 hover:border-accent hover:text-foreground transition"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>

      <div ref={scrollRef} className="chat-scroll flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                  : "bg-secondary text-foreground rounded-bl-sm border border-border/60"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-strong:text-foreground prose-strong:font-semibold prose-ul:my-1 prose-li:my-0.5">
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
        {hasError && lastUserText && (
          <div className="flex justify-center">
            <button
              onClick={() => send(lastUserText)}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition"
            >
              ↩ ลองอีกครั้ง
            </button>
          </div>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background/50 px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active filters</span>
          {activeChips.map((c) => (
            <button
              key={c.label}
              onClick={c.clear}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition"
            >
              {c.label} <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={() => onFiltersChange({})}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition"
          >
            Clear all
          </button>
        </div>
      )}

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
        {busy ? (
          <button
            type="button"
            onClick={cancel}
            className="grid h-10 w-10 place-items-center rounded-full bg-destructive text-destructive-foreground transition hover:scale-105"
            aria-label="Cancel"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}
