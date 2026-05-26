import type { Filters } from "@/lib/filterProperties";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type RagSource = {
  name: string | null;
  type: string | null;
  district: string | null;
  province: string | null;
  price_thb: number | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  url: string | null;
};

export async function ragChat({
  messages,
  signal,
  onDelta,
  onDone,
  onError,
  onResults,
}: {
  messages: ChatMsg[];
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  onResults?: (sources: RagSource[]) => void;
}) {
  try {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUser?.content ?? "";
    const history = messages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    const resp = await fetch("/api/rag-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, history }),
      signal,
    });

    if (!resp.ok) {
      let msg = "RAG service unavailable.";
      try {
        const j = await resp.json();
        if (j?.error) msg = j.error;
      } catch {
        /* noop */
      }
      onError(msg);
      return;
    }

    const data = await resp.json();
    const answer: string = data.answer ?? "";
    const mode: string = data.mode ?? "semantic";
    const modeLabel = mode === "location" ? "Location search" : "Semantic search";

    if (onResults && Array.isArray(data.sources) && data.sources.length > 0) {
      onResults((data.sources as RagSource[]).slice(0, 5));
    }

    onDelta(answer + `\n\n*${modeLabel}*`);
    onDone();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      onDone();
      return;
    }
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}

export async function streamChat({
  messages,
  filters,
  sessionId,
  signal,
  onFilters,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMsg[];
  filters?: Filters;
  sessionId?: string | null;
  signal?: AbortSignal;
  onFilters?: (data: { filters: Filters; total: number; sessionId?: string | null }) => void;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, filters: filters ?? {}, sessionId: sessionId ?? null }),
      signal,
    });

    if (!resp.ok || !resp.body) {
      let msg = "Failed to reach assistant.";
      try {
        const j = await resp.json();
        if (j?.error) msg = j.error;
      } catch {
        /* noop */
      }
      onError(msg);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let currentEvent = "message";
    let done = false;
    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line === "") {
          currentEvent = "message";
          continue;
        }
        if (line.startsWith(":")) continue;
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (currentEvent === "filters") {
          try {
            onFilters?.(JSON.parse(payload));
          } catch {
            /* noop */
          }
          continue;
        }
        if (payload === "[DONE]") {
          done = true;
          break;
        }
        try {
          const parsed = JSON.parse(payload);
          const c = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (c) onDelta(c);
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }
    onDone();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      onDone();
      return;
    }
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}
