import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Building2 } from "lucide-react";
import { streamChat, type ChatMsg } from "@/lib/streamChat";
import { toast } from "sonner";
import { type Filters } from "@/lib/filterProperties";

const QUICK = [
  "Find condos near Asok BTS",
  "Affordable place near Chulalongkorn",
  "Luxury rental in Thonglor",
  "Family home near Lat Phrao",
];

const AREA_KEYWORDS: { key: string; area: string }[] = [
  { key: "siam", area: "Siam" },
  { key: "asok", area: "Asok" },
  { key: "chula", area: "Pathumwan" },
  { key: "pathumwan", area: "Pathumwan" },
  { key: "sathorn", area: "Sathorn" },
  { key: "thonglor", area: "Thonglor" },
  { key: "thong lo", area: "Thonglor" },
  { key: "ari", area: "Ari" },
  { key: "phrom phong", area: "Phrom Phong" },
  { key: "iconsiam", area: "Khlong San" },
  { key: "lat phrao", area: "Lat Phrao" },
  { key: "ladprao", area: "Lat Phrao" },
  { key: "rangsit", area: "Rangsit" },
  { key: "thammasat", area: "Rangsit" },
];

function deriveFilters(text: string, prev: Filters): Filters {
  const t = text.toLowerCase();
  const next: Filters = { ...prev };

  for (const a of AREA_KEYWORDS) {
    if (t.includes(a.key)) { next.area = a.area; break; }
  }

  if (/\b(bts|mrt|skytrain|subway|train|transit|commute)\b/.test(t)) next.nearTransit = true;
  if (/\b(university|chula|thammasat|student|campus)\b/.test(t)) next.nearUniversity = true;
  if (/\b(mall|shopping|paragon|iconsiam|emquartier|central)\b/.test(t)) next.nearMall = true;

  if (/\b(buy|sale|purchase|own)\b/.test(t)) next.listingType = "sale";
  else if (/\b(rent|rental|lease|monthly)\b/.test(t)) next.listingType = "rent";

  if (/\bcondo/.test(t)) next.propertyType = "Condo";
  else if (/\bhouse\b/.test(t)) next.propertyType = "House";
  else if (/\btownhouse/.test(t)) next.propertyType = "Townhouse";
  else if (/\bapartment/.test(t)) next.propertyType = "Apartment";

  const bedMatch = t.match(/(\d+)\s*(bed|br|bedroom)/);
  if (bedMatch) next.bedrooms = parseInt(bedMatch[1], 10);
  if (/studio/.test(t)) next.bedrooms = 0;

  // budget like "30k", "30,000", "under 50000"
  const kMatch = t.match(/(\d{1,3})\s*k\b/);
  const numMatch = t.match(/(\d{2,3}[,]?\d{3})/);
  if (kMatch) next.maxPrice = parseInt(kMatch[1], 10) * 1000;
  else if (numMatch) next.maxPrice = parseInt(numMatch[1].replace(",", ""), 10);

  return next;
}

export function ChatPanel({
  filters,
  onFiltersChange,
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm **Estate AI**, your Bangkok property consultant. Tell me what you're looking for — area, budget, or lifestyle — and I'll line up matches on the right.",
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

    onFiltersChange(deriveFilters(text, filters));

    let acc = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);
    await streamChat({
      messages: next,
      onDelta: (chunk) => {
        acc += chunk;
        setMessages(prev => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m)));
      },
      onDone: () => setBusy(false),
      onError: (err) => {
        setBusy(false);
        toast.error(err);
        setMessages(prev => prev.slice(0, -1));
      },
    });
  };

  return (
    <div className="flex h-full flex-col rounded-2xl bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-elegant)" }}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-serif text-base font-semibold text-white">Estate AI</div>
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            Bangkok property consultant
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-accent" />
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
        {busy && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm italic text-muted-foreground">
              typing<span className="typing-ellipsis" />
            </div>
          </div>
        )}
      </div>

      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-background/50 px-4 py-3">
          {QUICK.map(q => (
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
        onSubmit={(e) => { e.preventDefault(); send(input); }}
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
          className="grid h-10 w-10 place-items-center rounded-full text-primary-foreground transition hover:scale-105 disabled:opacity-40"
          style={{ background: "var(--gradient-accent)" }}
          aria-label="Send"
        >
          <Send className="h-4 w-4 text-primary" />
        </button>
      </form>
    </div>
  );
}