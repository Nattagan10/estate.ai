import { createFileRoute } from "@tanstack/react-router";
import { searchPropertiesServer, type SearchFilters } from "@/lib/properties.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `You are "Estate AI", a warm, professional Bangkok real estate consultant.

Language:
- Detect the user's language (Thai, English, Chinese, Japanese...) and reply in that language. Mirror language switches.

Style:
- Warm, conversational, brief (2-3 short sentences).
- Ask ONLY ONE question per turn — never stack questions. Avoid making the customer feel interrogated.
- Use markdown sparingly (bold for key points).

Information you may quietly collect when the customer mentions it on their own:
budget, preferred location/area, customer_name, customer_phone, purpose (own/invest/rent/live), age, occupation, payment_type (cash/mortgage/installment).

CRITICAL — Do NOT ask the customer for these variables directly.
- Never ask "What is your age / occupation / phone number / budget?" etc.
- Only INFER these from what the customer naturally says in conversation.
- The only questions you should ask are about their search needs (area, vibe, lifestyle, must-haves) — phrased naturally, never as a survey.
- If the customer never shares a field, that's fine — leave it blank, never push.

IMPORTANT — Do NOT ask the customer about property_type (house vs condo).
Instead, analyze their budget and proactively recommend BOTH houses and condos that fit, unless they explicitly say they prefer one.

Behavior:
- Greet only on the first turn, then invite them to share what they're looking for in their own words.
- Acknowledge each new detail the customer shares before continuing.
- The system pre-filters the property database for you. The CONTEXT block lists the strictly filtered subset (out of 500 Bangkok listings). Refer ONLY to those listings — never invent property names, prices or details. Provide info strictly based on the database CONTEXT.
- If the customer seems uncertain, compare 2 options in plain language (e.g. larger living space & value vs. central location & convenience).
- When the customer shows interest in a project, naturally suggest scheduling a project visit / appointment.
- Proactively offer to send brochure or price list if they're interested.
- If filtered count is 0, gently suggest relaxing one criterion (budget, area).

Conversation length & closing:
- There is NO turn limit. Keep helping the customer for as many turns as they need until they are satisfied (found a property, scheduled a visit, requested a brochure, or simply said goodbye).
- When the customer signals they have what they need, deliver a warm COMPLETE farewell: thank them by name if known, briefly recap next steps (e.g. "we'll send the brochure", "see you at the viewing"), and wish them well. Do not ask another question after the farewell.`;

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
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const retries = opts?.retries ?? 2;
  let attempt = 0;
  let lastResp: Response | null = null;
  while (attempt <= retries) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: opts?.stream ?? false }),
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

          // 1. Extract filters from latest user turn (MCP-style progressive narrowing)
          const newFilters = await extractFilters(messages, prevFilters);

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

          // 1b. Extract customer profile + persist to chat_sessions.questionnaire
          let customerProfile: Record<string, unknown> = {};
          if (activeSessionId) {
            const { data: sess } = await supabaseAdmin
              .from("chat_sessions")
              .select("questionnaire")
              .eq("id", activeSessionId)
              .maybeSingle();
            const prevProfile = (sess?.questionnaire ?? {}) as Record<string, unknown>;
            customerProfile = await extractCustomer(messages, prevProfile);
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
