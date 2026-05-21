import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rowToProperty, type DbPropertyRow, type Property } from "@/data/properties";

const FiltersSchema = z.object({
  area: z.string().optional(),
  propertyType: z.enum(["condo", "house", "townhouse", "commercial", "Any"]).optional(),
  propertyTypes: z.array(z.enum(["condo", "house", "townhouse", "commercial"])).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  nearTransit: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type SearchFilters = z.infer<typeof FiltersSchema>;

export type MapPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  price: number;
  area_name: string;
};

const PROPERTY_TYPE_MAP: Record<string, string[]> = {
  condo:      ["condo", "apartment", "condominium"],
  house:      ["detached house", "semi-detached house", "villa", "bungalow"],
  townhouse:  ["townhome", "townhouse"],
  commercial: ["commercial", "retail", "office", "shophouse"],
};

function applyFilters(query: any, f: SearchFilters) {
  let q = query;

  if (f.area) {
    q = q.or(
      `name.ilike.%${f.area}%,neighborhood.ilike.%${f.area}%,district.ilike.%${f.area}%,province.ilike.%${f.area}%`,
    );
  }

  if (f.propertyTypes && f.propertyTypes.length > 0) {
    const orClauses = f.propertyTypes
      .flatMap((t) => (PROPERTY_TYPE_MAP[t] ?? [t]).map((k) => `property_type.ilike.%${k}%`))
      .join(",");
    q = q.or(orClauses);
  } else if (f.propertyType && f.propertyType !== "Any") {
    const keywords = PROPERTY_TYPE_MAP[f.propertyType] ?? [f.propertyType];
    const orClauses = keywords.map((k) => `property_type.ilike.%${k}%`).join(",");
    q = q.or(orClauses);
  }

  if (f.minPrice != null) q = q.gte("price_thb", f.minPrice);
  if (f.maxPrice != null) q = q.lte("price_thb", f.maxPrice);

  if (f.nearTransit) q = q.not("near_transit", "is", null);

  return q;
}

export async function searchPropertiesServer(
  filters: SearchFilters,
): Promise<{ properties: Property[]; total: number }> {
  const f = FiltersSchema.parse(filters ?? {});
  const pageSize = f.limit ?? 50;
  const from = ((f.page ?? 1) - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("rag_properties")
    .select("*", { count: "estimated" })
    .order("price_thb", { ascending: true, nullsFirst: false });

  query = applyFilters(query, f);
  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DbPropertyRow[];
  return { properties: rows.map(rowToProperty), total: count ?? rows.length };
}

export const searchProperties = createServerFn({ method: "POST" })
  .inputValidator((data: SearchFilters) => FiltersSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    return searchPropertiesServer(data);
  });

export const fetchMapPins = createServerFn({ method: "POST" })
  .inputValidator((data: SearchFilters) => FiltersSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<{ pins: MapPin[] }> => {
    const f = FiltersSchema.parse(data ?? {});
    let query = supabaseAdmin
      .from("rag_properties")
      .select("id, name, latitude, longitude, price_thb, district, neighborhood")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    query = applyFilters(query as any, f) as any;
    const { data: rows, error } = await (query as any).limit(2000);
    if (error) throw new Error(error.message);

    const pins: MapPin[] = (rows ?? []).map((r: any) => ({
      id: r.id as string,
      name: (r.name ?? r.district ?? "Property") as string,
      lat: r.latitude as number,
      lng: r.longitude as number,
      price: (r.price_thb ?? 0) as number,
      area_name: (r.neighborhood ?? r.district ?? "") as string,
    }));

    return { pins };
  });

export const getAreaList = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("rag_properties")
    .select("district")
    .not("district", "is", null)
    .limit(2000);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  (data ?? []).forEach((r: { district: string }) => r.district && set.add(r.district));
  return { areas: Array.from(set).sort() };
});

// ---- Admin CRUD ----

const PropertyInput = z.object({
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
  nbr_floors: z.number().int().optional(),
  rental_yield: z.number().optional(),
  near_transit: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  url: z.string().max(1000).default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  coord_accurate: z.boolean().default(false),
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
      .from("rag_properties")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
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
    const payload = { ...data, id: data.id ?? `MANUAL-${Date.now()}` };
    if (data.id) {
      const { error } = await supabaseAdmin.from("rag_properties").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("rag_properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [props, sessions, logs] = await Promise.all([
      supabaseAdmin
        .from("rag_properties")
        .select("district, property_type, price_thb"),
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
      if (r.district) byArea[r.district] = (byArea[r.district] ?? 0) + 1;
      if (r.property_type) byType[r.property_type] = (byType[r.property_type] ?? 0) + 1;
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
