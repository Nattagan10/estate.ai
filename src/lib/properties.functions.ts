import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rowToProperty, type DbPropertyRow, type Property } from "@/data/properties";

const FiltersSchema = z.object({
  area: z.string().optional(),
  propertyType: z.enum(["condo", "house", "townhouse", "commercial", "Any"]).optional(),
  listingType: z.enum(["rent", "sale", "Any"]).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  bedrooms: z.number().int().min(0).max(10).optional(),
  nearTransit: z.boolean().optional(),
  nearUniversity: z.boolean().optional(),
  nearMall: z.boolean().optional(),
  availability: z.enum(["available", "reserved", "sold"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
export type SearchFilters = z.infer<typeof FiltersSchema>;

function applyFilters(query: any, f: SearchFilters) {
  let q = query;
  if (f.area) q = q.ilike("area_name", `%${f.area}%`);
  if (f.propertyType && f.propertyType !== "Any") q = q.eq("property_type", f.propertyType);
  if (f.listingType && f.listingType !== "Any") q = q.eq("listing_type", f.listingType);
  if (f.minPrice != null) q = q.gte("price", f.minPrice);
  if (f.maxPrice != null) q = q.lte("price", f.maxPrice);
  if (f.bedrooms != null) q = q.gte("bedrooms", f.bedrooms);
  if (f.availability) q = q.eq("availability_status", f.availability);
  return q;
}

export async function searchPropertiesServer(
  filters: SearchFilters,
): Promise<{ properties: Property[]; total: number }> {
  const f = FiltersSchema.parse(filters ?? {});
  const limit = f.limit ?? 60;

  let query = supabaseAdmin.from("properties").select("*", { count: "exact" });
  query = applyFilters(query, f);
  const { data, error, count } = await query.limit(limit);
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as DbPropertyRow[];
  // Tag-based "near X" filters require post-filter on jsonb
  const matchTransit = (p: DbPropertyRow) =>
    (p.nearby ?? []).some((n) => n.type === "BTS" || n.type === "MRT");
  const matchUni = (p: DbPropertyRow) => (p.nearby ?? []).some((n) => n.type === "University");
  const matchMall = (p: DbPropertyRow) => (p.nearby ?? []).some((n) => n.type === "Mall");
  if (f.nearTransit) rows = rows.filter(matchTransit);
  if (f.nearUniversity) rows = rows.filter(matchUni);
  if (f.nearMall) rows = rows.filter(matchMall);

  return { properties: rows.map(rowToProperty), total: count ?? rows.length };
}

export const searchProperties = createServerFn({ method: "POST" })
  .inputValidator((data: SearchFilters) => FiltersSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    return searchPropertiesServer(data);
  });

export const getAreaList = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.from("properties").select("area_name");
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  (data ?? []).forEach((r: { area_name: string }) => set.add(r.area_name));
  return { areas: Array.from(set).sort() };
});

// ---- Admin CRUD ----

const PropertyInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  property_type: z.enum(["condo", "house", "townhouse", "commercial"]),
  listing_type: z.enum(["rent", "sale"]),
  price: z.number().nonnegative(),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  area_sqm: z.number().nonnegative(),
  area_name: z.string().min(1).max(100),
  lat: z.number(),
  lng: z.number(),
  address: z.string().max(300).default(""),
  image_url: z.string().max(1000).default(""),
  availability_status: z.enum(["available", "reserved", "sold"]).default("available"),
  tags: z.array(z.string()).default([]),
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not an admin");
}

export const adminListProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; limit?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("properties")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, count, error } = await q.limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as DbPropertyRow[], total: count ?? 0 };
  });

export const adminUpsertProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PropertyInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("properties").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("properties")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const adminDeleteProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [props, sessions, logs] = await Promise.all([
      supabaseAdmin.from("properties").select("area_name, property_type, price, listing_type"),
      supabaseAdmin
        .from("chat_sessions")
        .select("id, questionnaire, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("chat_logs")
        .select("id, session_id, role, content, filters_applied, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (props.error) throw new Error(props.error.message);
    if (sessions.error) throw new Error(sessions.error.message);
    if (logs.error) throw new Error(logs.error.message);

    const byArea: Record<string, number> = {};
    const byType: Record<string, number> = {};
    (props.data ?? []).forEach((r: any) => {
      byArea[r.area_name] = (byArea[r.area_name] ?? 0) + 1;
      byType[r.property_type] = (byType[r.property_type] ?? 0) + 1;
    });
    return {
      counts: {
        properties: (props.data ?? []).length,
        sessions: (sessions.data ?? []).length,
        logs: (logs.data ?? []).length,
      },
      byArea,
      byType,
      sessions: sessions.data ?? [],
      logs: logs.data ?? [],
    };
  });
