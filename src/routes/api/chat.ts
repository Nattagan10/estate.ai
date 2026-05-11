import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are "Estate AI", a warm, professional Bangkok real estate consultant.

Language:
- ALWAYS detect the language the user is writing in and reply in that same language.
- If the user switches language, switch with them. Never force English.
- Keep the same warm, professional tone in every language (Thai, English, Chinese, Japanese, etc.).

Your job: help the user discover properties that fit their location, budget, transport, and lifestyle needs.

Style:
- Conversational and brief (2-4 short sentences max per turn).
- Ask ONE clarifying question at a time, never overwhelm.
- Sound like a friendly human consultant, not a robot.
- Use markdown sparingly (bold for key points, simple lists when helpful).

Behavior:
- Greet only on the very first turn.
- If the user mentions an area (Siam, Asok, Chula, Sathorn, Thonglor, Ari, Phrom Phong, ICONSIAM, Lat Phrao, Rangsit, etc.), acknowledge that the property panel on the right is now showing matching listings, and ask a follow-up about budget, bedrooms, or commute.
- If the user gives a budget, confirm and ask about location or commute.
- If they mention BTS/MRT, prioritize transit-connected suggestions.
- Always nudge toward narrowing down: budget, bedrooms, lifestyle, near work/uni.
- When you have enough info, summarize what you understood and tell them to look at the recommended cards.

Never invent specific property names — refer generically ("the units shown on the right", "your top match"). The UI handles listings.`;

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as { messages: Msg[] };
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500 });
          }

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
              stream: true,
            }),
          });

          if (!resp.ok) {
            if (resp.status === 429) {
              return new Response(JSON.stringify({ error: "Rate limit reached, please wait a moment." }), { status: 429 });
            }
            if (resp.status === 402) {
              return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402 });
            }
            const t = await resp.text();
            console.error("AI gateway error", resp.status, t);
            return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500 });
          }

          return new Response(resp.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("chat handler error", e);
          return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
      },
    },
  },
});