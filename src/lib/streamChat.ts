import type { Filters } from "@/lib/filterProperties";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function streamChat({
  messages,
  filters,
  sessionId,
  onFilters,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMsg[];
  filters?: Filters;
  sessionId?: string | null;
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
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}
