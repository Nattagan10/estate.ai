export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMsg[];
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!resp.ok || !resp.body) {
      let msg = "Failed to reach assistant.";
      try {
        const j = await resp.json();
        if (j?.error) msg = j.error;
      } catch { /* noop */ }
      onError(msg);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let done = false;
    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      textBuffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, nl);
        textBuffer = textBuffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(json);
          const c = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (c) onDelta(c);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}