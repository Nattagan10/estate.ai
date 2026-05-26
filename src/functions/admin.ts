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
    z.object({ username: z.string(), password: z.string() }).parse(d),
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
      .limit(450);
    if (error) {
      console.error("Admin fetch error:", error);
      return { sessions: [] };
    }

    // Get message counts per session
    const ids = (sessions ?? []).map((s) => s.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: logs } = await supabaseAdmin
        .from("chat_logs")
        .select("session_id")
        .in("session_id", ids);
      (logs ?? []).forEach((l: any) => {
        counts[l.session_id] = (counts[l.session_id] ?? 0) + 1;
      });
    }
    return { sessions: (sessions ?? []).map((s) => ({ ...s, message_count: counts[s.id] ?? 0 })) };
  });

export const adminGetSessionLogs = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; sessionId: string }) =>
    z.object({ token: z.string(), sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const [s, l] = await Promise.all([
      supabaseAdmin.from("chat_sessions").select("*").eq("id", data.sessionId).single(),
      supabaseAdmin
        .from("chat_logs")
        .select("*")
        .eq("session_id", data.sessionId)
        .order("created_at", { ascending: true }),
    ]);
    if (s.error) throw new Error(s.error.message);
    if (l.error) throw new Error(l.error.message);
    return { session: s.data, logs: l.data ?? [] };
  });

const PropertySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  property_type: z.string().default("Condo"),
  province: z.string().max(100).default(""),
  district: z.string().max(100).default(""),
  neighborhood: z.string().max(100).default(""),
  developer: z.string().max(200).default(""),
  price_thb: z.number().nonnegative().default(0),
  price_per_sqm: z.number().nonnegative().default(0),
  year_built: z.number().int().optional(),
  near_transit: z.string().optional(),
  url: z.string().max(1000).default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  coord_accurate: z.boolean().default(false),
});
export type AdminPropertyRow = z.infer<typeof PropertySchema> & { id: string; created_at?: string };

export const adminListProperties = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; search?: string; limit?: number }) =>
    z.object({ token: z.string(), search: z.string().optional(), limit: z.number().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    let q = supabaseAdmin
      .from("rag_properties")
      .select("id, name, property_type, district, neighborhood, developer, price_thb, near_transit, url, latitude, longitude, created_at", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, count, error } = await q.limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as AdminPropertyRow[], total: count ?? 0 };
  });

export const adminUpsertProperty = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string(), property: PropertySchema }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const prop = data.property;
    const payload = { ...prop, id: prop.id ?? `MANUAL-${Date.now()}` };
    if (prop.id) {
      const { error } = await supabaseAdmin.from("rag_properties").update(payload).eq("id", prop.id);
      if (error) throw new Error(error.message);
      return { id: prop.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("rag_properties")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const adminDeleteProperty = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const { error } = await supabaseAdmin.from("rag_properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteSession = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; sessionId: string }) =>
    z.object({ token: z.string(), sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);

    // Explicitly delete logs first just in case there's no cascade on the foreign key
    await supabaseAdmin.from("chat_logs").delete().eq("session_id", data.sessionId);

    const { error } = await supabaseAdmin.from("chat_sessions").delete().eq("id", data.sessionId);
    if (error) throw new Error(error.message);

    return { success: true };
  });
