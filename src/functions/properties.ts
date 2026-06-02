import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rowToProperty, type DbPropertyRow, type Property } from "@/shared/data/properties";

const FiltersSchema = z.object({
  area: z.string().optional(),
  propertyType: z.enum(["condo", "house", "townhouse", "commercial", "Any"]).optional(),
  propertyTypes: z.array(z.enum(["condo", "house", "townhouse", "commercial"])).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  nearTransit: z.boolean().optional(),
  sortBy: z.enum(["price_asc", "price_desc", "newest", "yield"]).optional(),
  minYearBuilt: z.number().int().optional(),
  hasYield: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  // Distance filter
  lat: z.number().optional(),
  lng: z.number().optional(),
  maxDistanceM: z.number().int().optional(),
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

function buildTypeKeywords(f: SearchFilters): string[] | null {
  if (f.propertyTypes && f.propertyTypes.length > 0)
    return f.propertyTypes.flatMap((t) => PROPERTY_TYPE_MAP[t] ?? [t]);
  if (f.propertyType && f.propertyType !== "Any")
    return PROPERTY_TYPE_MAP[f.propertyType] ?? [f.propertyType];
  return null;
}

// Maps BTS/landmark area names (used in UI/chat) → district_canonical values stored in DB
const AREA_TO_CANONICAL: Record<string, string> = {
  // Watthana district
  "Asok": "Watthana", "Asoke": "Watthana", "Thonglor": "Watthana", "Phrom Phong": "Watthana",
  "Ekkamai": "Watthana", "Nana": "Watthana", "Phloen Chit": "Watthana",
  // Sathon district
  "Sathorn": "Sathon",
  // Bang Rak district
  "Silom": "Bang Rak",
  // Pathum Wan district
  "Siam": "Pathum Wan", "Chidlom": "Pathum Wan", "Ratchadamri": "Pathum Wan",
  // Phra Khanong district
  "On Nut": "Phra Khanong", "Udom Suk": "Phra Khanong", "Bearing": "Phra Khanong", "Samrong": "Phra Khanong",
  // Huai Khwang district
  "Ratchada": "Huai Khwang", "Rama 9": "Huai Khwang", "Thailand Cultural Centre": "Huai Khwang", "Sutthisan": "Huai Khwang",
  // Phaya Thai district
  "Ari": "Phaya Thai", "Saphan Khwai": "Phaya Thai", "Victory Monument": "Phaya Thai", "Ratchathewi": "Phaya Thai", "Phaya Thai": "Phaya Thai",
  // Chatuchak district
  "Mo Chit": "Chatuchak", "Chatuchak": "Chatuchak",
  // Others
  "Bang Sue": "Bang Sue", "Lat Phrao": "Lat Phrao", "Bang Na": "Bang Na",
  "Phra Khanong": "Phra Khanong", "Huai Khwang": "Huai Khwang",
};

function resolveArea(area: string | undefined): string | undefined {
  if (!area) return undefined;
  return AREA_TO_CANONICAL[area] ?? area;
}

export async function searchPropertiesServer(
  filters: SearchFilters,
): Promise<{ properties: Property[]; total: number }> {
  const f = FiltersSchema.parse(filters ?? {});

  const { data, error } = await (supabaseAdmin as any).rpc("rpc_search_properties", {
    p_area:           resolveArea(f.area) ?? null,
    p_property_types: buildTypeKeywords(f),
    p_min_price:      f.minPrice ?? null,
    p_max_price:      f.maxPrice ?? null,
    p_near_transit:   f.nearTransit ?? false,
    p_page:           f.page ?? 1,
    p_limit:          f.limit ?? 50,
    p_sort_by:        f.sortBy ?? "relevance",
    p_min_year:       f.minYearBuilt ?? null,
    p_has_yield:      f.hasYield ?? false,
    p_lat:            f.lat ?? null,
    p_lng:            f.lng ?? null,
    p_max_dist_m:     f.maxDistanceM ?? null,
  });
  if (error) throw new Error(error.message);

  const result = (data as unknown) as { total: number; rows: DbPropertyRow[] };
  return {
    properties: (result.rows ?? []).map(rowToProperty),
    total: result.total ?? 0,
  };
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

    const { data: result, error } = await (supabaseAdmin as any).rpc("rpc_fetch_map_pins", {
      p_area:           resolveArea(f.area) ?? null,
      p_property_types: buildTypeKeywords(f),
      p_min_price:      f.minPrice ?? null,
      p_max_price:      f.maxPrice ?? null,
      p_near_transit:   f.nearTransit ?? false,
      p_min_year:       f.minYearBuilt ?? null,
      p_has_yield:      f.hasYield ?? false,
      p_lat:            f.lat ?? null,
      p_lng:            f.lng ?? null,
      p_max_dist_m:     f.maxDistanceM ?? null,
    });
    if (error) throw new Error(error.message);

    return { pins: ((result as unknown) as MapPin[]) ?? [] };
  });

export const getAreaList = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
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
    let q = (supabaseAdmin as any)
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
      const { error } = await (supabaseAdmin as any).from("rag_properties").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await (supabaseAdmin as any)
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
    const { error } = await (supabaseAdmin as any).from("rag_properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [props, sessions, logs] = await Promise.all([
      (supabaseAdmin as any)
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
