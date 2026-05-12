import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Demo-only hardcoded admin token. Not for production.
const ADMIN_TOKEN = "1111";
const ADMIN_USER = "Admin";

function assertToken(token: string | undefined) {
  if (token !== ADMIN_TOKEN) throw new Error("Unauthorized");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) =>
    z.object({ username: z.string(), password: z.string() }).parse(d)
  )
  .handler(async ({ data }) => {
    if (data.username !== ADMIN_USER || data.password !== ADMIN_TOKEN) {
      throw new Error("Invalid credentials");
    }
    return { token: ADMIN_TOKEN };
  });

export const adminListSessions = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertToken(data.token);
    const { data: sessions, error } = await supabaseAdmin
      .from("chat_sessions")
      .select("id, questionnaire, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Get message counts per session
    const ids = (sessions ?? []).map((s) => s.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: logs } = await supabaseAdmin
        .from("chat_logs")
        .select("session_id")
        .in("session_id", ids);
      (logs ?? []).forEach((l: any) => { counts[l.session_id] = (counts[l.session_id] ?? 0) + 1; });
    }
    return { sessions: (sessions ?? []).map((s) => ({ ...s, message_count: counts[s.id] ?? 0 })) };
  });

export const adminGetSessionLogs = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; sessionId: string }) =>
    z.object({ token: z.string(), sessionId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const [s, l] = await Promise.all([
      supabaseAdmin.from("chat_sessions").select("*").eq("id", data.sessionId).single(),
      supabaseAdmin.from("chat_logs").select("*").eq("session_id", data.sessionId).order("created_at", { ascending: true }),
    ]);
    if (s.error) throw new Error(s.error.message);
    if (l.error) throw new Error(l.error.message);
    return { session: s.data, logs: l.data ?? [] };
  });
