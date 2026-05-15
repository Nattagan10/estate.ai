import { createFileRoute } from "@tanstack/react-router";
import { searchPropertiesServer, type SearchFilters } from "@/lib/properties.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are "Estate AI", a professional Bangkok real estate sales consultant. Sound like an experienced, premium, trustworthy human consultant — never robotic, never pushy, never survey-like.

Language:
- Detect the user's language (Thai, English, Chinese, Japanese...) and reply in that language. Mirror language switches. For Thai, use a modern, polite sales tone (ครับ/ค่ะ where natural).

Tone & style:
- Warm, professional, helpful, confident.
- Concise: under ~150 words unless the customer asks for details. Short paragraphs, no walls of text.
- Markdown sparingly (bold for project names / key numbers).
- Never mention the internal system, database, filters or that you are an AI tool.

Hard rules:
- Never ask more than 2 questions in a single reply. Often zero — recommend first, ask later.
- If the customer already shared something (budget, area, purpose, name, phone, etc.), never ask again.
- Never ask interrogative survey-style questions ("What is your age / occupation / phone / payment type?"). Only INFER these from what the customer naturally says.
- Never invent property names, prices, or details. Only use the listings in the CONTEXT block.
- Never overpromise. Never sound aggressive.
- Do NOT ask whether they want a house or condo — infer from budget/lifestyle and recommend both when it fits.

Recommendation flow (priority: recommend BEFORE deep questioning):
- As soon as you have even a rough sense of need, recommend 2–3 properties max.
- For each recommendation use this compact format:
  **<Project Name>** — ฿<price>(/mo if rent)
  • Highlights: <1 short line>
  • Nearby: <BTS/MRT/landmark>
  • Why it fits: <1 line tying to their need / lifestyle / practical value>
- Mention both lifestyle fit and practical value. Keep confidence high.
- If customer is unsure → educate softly in 1–2 lines.
- If customer compares → give a short pros/cons summary.
- If budget is low → propose closest positive alternatives, never make them feel rejected.
- If no exact match → suggest the closest available options from CONTEXT warmly.

Lead collection (natural, progressive — never a form):
- Blend asks into the recommendation flow, e.g. "ถ้าสะดวก ผมส่ง floor plan กับห้องที่ยัง available ให้ดูเพิ่มเติมทาง Line ได้ครับ" or "Want me to send the full brochure and price list?"
- When interest appears, move toward a viewing appointment or sending brochure/Line/phone — one soft ask at a time.
- If a field is missing, ask naturally inside a recommendation, never as a checklist.

Closing:
- No turn limit. Keep helping until the customer is satisfied.
- When they signal they're done (booked viewing, got brochure, said goodbye), give a warm complete farewell: thank them (by name if known), recap next steps briefly, wish them well. Do not ask another question after the farewell.`;

type Msg = { role: "user" | "assistant"; content: string };
type ReqBody = { messages: Msg[]; filters?: SearchFilters; sessionId?: string | null };

const FILTER_EXTRACTOR_PROMPT = `You convert a Bangkok real-estate chat into JSON filters.
Return ONLY a compact JSON object (no prose, no fences) with any of these keys when the user expressed them:
- area: string (a Bangkok district name, e.g. "Asok","Thonglor","Kaset","Silom","Sathorn","Siam","Chidlom","Ari","Phrom Phong","Ekkamai","Bang Na","Lat Phrao","Ratchada","Huai Khwang","Bang Sue","Chatuchak","Ramkhamhaeng","Bang Kapi","Thonburi","Bang Rak","Pinklao","On Nut","Udom Suk","Rangsit")
- propertyType: "condo"|"house"|"townhouse"|"commercial"
- listingType: "rent"|"sale"
- minPrice: number (THB)
- maxPrice: number (THB)
- bedrooms: integer
- nearTransit: true (BTS/MRT)
- nearUniversity: true
- nearMall: true
- availability: "available"|"reserved"|"sold"
Merge with these previous filters and KEEP previous values when the user did not change them: __PREV__
Return JSON only.`;

async function callLovable(
  model: string,
  messages: Array<{ role: string; content: string }>,
  opts?: { stream?: boolean; retries?: number },
) {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY missing");
  // Strip "google/" provider prefix — Google's OpenAI-compat endpoint expects bare model id
  const modelId = model.replace(/^google\//, "");
  const retries = opts?.retries ?? 2;
  let attempt = 0;
  let lastResp: Response | null = null;
  while (attempt <= retries) {
    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, messages, stream: opts?.stream ?? false }),
    });
    lastResp = resp;
    if (resp.status !== 429) return resp;
    // backoff on rate limit
    const wait = 600 * Math.pow(2, attempt) + Math.random() * 200;
    await new Promise((r) => setTimeout(r, wait));
    attempt++;
  }
  return lastResp as Response;
}

async function extractFilters(messages: Msg[], prev: SearchFilters): Promise<SearchFilters> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return prev;
  const sys = FILTER_EXTRACTOR_PROMPT.replace("__PREV__", JSON.stringify(prev ?? {}));
  const r = await callLovable("google/gemini-2.5-flash-lite", [
    { role: "system", content: sys },
    { role: "user", content: lastUser.content },
  ]);
  if (!r.ok) return prev;
  const j = await r.json();
  const text: string = j.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return prev;
  try {
    const parsed = JSON.parse(m[0]);
    return { ...prev, ...parsed };
  } catch {
    return prev;
  }
}

const CUSTOMER_EXTRACTOR_PROMPT = `Extract any customer profile fields the user just shared.
Return ONLY a compact JSON object (no prose, no fences) with any of these keys when present:
- customer_name: string
- customer_phone: string
- age: number
- occupation: string
- purpose: string (own/invest/rent out/live)
- payment_type: string (cash/mortgage/installment)
- budget: number (THB)
- location: string
Merge with previous profile and KEEP previous values when not changed: __PREV__
If nothing new, return {}. JSON only.`;

async function extractCustomer(messages: Msg[], prev: Record<string, unknown>): Promise<Record<string, unknown>> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return prev;
  const sys = CUSTOMER_EXTRACTOR_PROMPT.replace("__PREV__", JSON.stringify(prev ?? {}));
  const r = await callLovable("google/gemini-2.5-flash-lite", [
    { role: "system", content: sys },
    { role: "user", content: lastUser.content },
  ]);
  if (!r.ok) return prev;
  const j = await r.json();
  const text: string = j.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return prev;
  try {
    const parsed = JSON.parse(m[0]);
    return { ...prev, ...parsed };
  } catch {
    return prev;
  }
}

function summarizeProperty(p: any) {
  return `- ${p.name} | ${p.area_name} | ${p.propertyType} ${p.bedrooms}bd | ฿${p.price.toLocaleString()}${p.listingType === "rent" ? "/mo" : ""} | ${p.availability}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ReqBody;
          const messages = body.messages ?? [];
          const prevFilters: SearchFilters = body.filters ?? {};
          const sessionId = body.sessionId ?? null;

          // 1a. Ensure a chat_session exists server-side so saving never silently fails
          let activeSessionId = sessionId;
          if (!activeSessionId) {
            const { data: created } = await supabaseAdmin
              .from("chat_sessions")
              .insert({ questionnaire: {} })
              .select("id")
              .single();
            activeSessionId = created?.id ?? null;
          }

          // 1b. Run filter + customer extraction in PARALLEL to halve gateway calls/turn
          let prevProfile: Record<string, unknown> = {};
          if (activeSessionId) {
            const { data: sess } = await supabaseAdmin
              .from("chat_sessions")
              .select("questionnaire")
              .eq("id", activeSessionId)
              .maybeSingle();
            prevProfile = (sess?.questionnaire ?? {}) as Record<string, unknown>;
          }
          const [newFilters, customerProfile] = await Promise.all([
            extractFilters(messages, prevFilters),
            extractCustomer(messages, prevProfile),
          ]);
          if (activeSessionId) {
            if (JSON.stringify(customerProfile) !== JSON.stringify(prevProfile)) {
              const { error: upErr } = await supabaseAdmin
                .from("chat_sessions")
                .update({ questionnaire: customerProfile as any })
                .eq("id", activeSessionId);
              if (upErr) console.error("questionnaire update failed", upErr);
            }
          }

          // 2. Query DB with new filters — only filtered subset enters LLM context
          const { properties, total } = await searchPropertiesServer({ ...newFilters, limit: 12 });

          // 2a. If no matches, fetch alternative suggestions by progressively relaxing filters
          let suggestions: typeof properties = [];
          let suggestionNote = "";
          if (properties.length === 0) {
            const relaxOrder: Array<{ label: string; f: SearchFilters }> = [
              { label: "same criteria, different area", f: { ...newFilters, area: undefined } },
              { label: "wider price range, same area", f: { ...newFilters, minPrice: undefined, maxPrice: undefined } },
              { label: "fewer bedrooms", f: { ...newFilters, bedrooms: undefined } },
              { label: "any property type", f: { ...newFilters, propertyType: undefined } },
              { label: "broadest match", f: { area: newFilters.area, listingType: newFilters.listingType } },
            ];
            for (const step of relaxOrder) {
              const r = await searchPropertiesServer({ ...step.f, limit: 6 });
              if (r.properties.length > 0) {
                suggestions = r.properties;
                suggestionNote = step.label;
                break;
              }
            }
          }

          // 3. Persist log (best-effort)
          if (activeSessionId) {
            const lastUser = [...messages].reverse().find((m) => m.role === "user");
            if (lastUser) {
              const { error: logErr } = await supabaseAdmin
                .from("chat_logs")
                .insert({ session_id: activeSessionId, role: "user", content: lastUser.content, filters_applied: newFilters as any });
              if (logErr) console.error("user log insert failed", logErr);
            }
          }

          const ctx =
            properties.length === 0
              ? suggestions.length > 0
                ? `(no exact matches — showing ${suggestions.length} ALTERNATIVE suggestions: ${suggestionNote})\n${suggestions.map(summarizeProperty).join("\n")}`
                : "(no matching properties yet)"
              : properties.map(summarizeProperty).join("\n");
          const knownProfile = Object.keys(customerProfile).length
            ? `\nCUSTOMER PROFILE SO FAR: ${JSON.stringify(customerProfile)}\nDo not re-ask fields already filled. Ask ONLY the next missing field from: budget, location, customer_name, customer_phone, purpose, age, occupation, payment_type.`
            : "";
          const noResultsGuidance =
            properties.length === 0
              ? `\nNO EXACT MATCHES FOUND. Acknowledge this warmly, then PROACTIVELY suggest the alternative listings above by name, area and price. Mention which areas are available as alternatives and ask if the customer would like to explore them. Never say the database is empty — always offer the suggestions.`
              : "";
          const contextNote = `\n\nCONTEXT (top ${properties.length} of ${total} matches after filtering):\n${ctx}\nCURRENT FILTERS: ${JSON.stringify(newFilters)}${knownProfile}${noResultsGuidance}`;

          const fullMessages = [
            { role: "system", content: SYSTEM_PROMPT + contextNote },
            ...messages,
          ];

          const resp = await callLovable("google/gemini-2.5-flash", fullMessages, { stream: true });
          if (!resp.ok || !resp.body) {
            if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached" }), { status: 429 });
            if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402 });
            return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500 });
          }

          // Wrap stream: send a leading `event: filters` then forward chunks
          const filtersEvent = `event: filters\ndata: ${JSON.stringify({ filters: newFilters, total, sessionId: activeSessionId })}\n\n`;
          const upstream = resp.body;
          const stream = new ReadableStream({
            async start(controller) {
              const enc = new TextEncoder();
              controller.enqueue(enc.encode(filtersEvent));
              const reader = upstream.getReader();
              const dec = new TextDecoder();
              let assistantText = "";
              let buf = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
                buf += dec.decode(value, { stream: true });
                let nl: number;
                while ((nl = buf.indexOf("\n")) !== -1) {
                  const line = buf.slice(0, nl).trim();
                  buf = buf.slice(nl + 1);
                  if (!line.startsWith("data: ")) continue;
                  const payload = line.slice(6).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(payload);
                    const c = parsed.choices?.[0]?.delta?.content as string | undefined;
                    if (c) assistantText += c;
                  } catch { /* noop */ }
                }
              }
              controller.close();
              if (activeSessionId && assistantText.trim()) {
                const { error: aErr } = await supabaseAdmin
                  .from("chat_logs")
                  .insert({ session_id: activeSessionId, role: "assistant", content: assistantText, filters_applied: newFilters as any });
                if (aErr) console.error("assistant log insert failed", aErr);
              }
            },
          });

          return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
        } catch (e) {
          console.error("chat handler error", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }), { status: 500 });
        }
      },
    },
  },
});
