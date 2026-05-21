import { createFileRoute } from "@tanstack/react-router";

type RagRequest = {
  query: string;
  history: { role: string; content: string }[];
};

export const Route = createFileRoute("/api/rag-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as RagRequest;

          const ragServiceUrl = process.env.RAG_SERVICE_URL ?? "http://localhost:8000";

          const resp = await fetch(`${ragServiceUrl}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: body.query,
              history: body.history ?? [],
            }),
          });

          if (!resp.ok) {
            let detail = "RAG service error";
            try {
              const j = await resp.json();
              if (j?.detail) detail = j.detail;
            } catch { /* noop */ }
            return new Response(JSON.stringify({ error: detail }), {
              status: resp.status,
              headers: { "Content-Type": "application/json" },
            });
          }

          const data = await resp.json();
          return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const isConnRefused =
            e instanceof Error &&
            (e.message.includes("ECONNREFUSED") || e.message.includes("fetch failed"));

          if (isConnRefused) {
            return new Response(
              JSON.stringify({ error: "RAG service is not running. Start python-service/app.py first." }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
