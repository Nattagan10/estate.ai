// Property type — maps from Supabase `rag_properties` table (53k rows from Baania)
export type Property = {
  id: string;
  name: string;
  description: string;
  price: number;
  listingType: "rent" | "sale";
  propertyType: "condo" | "house" | "townhouse" | "commercial";
  bedrooms: number;
  bathrooms: number;
  area: number;
  area_name: string;
  lat: number;
  lng: number;
  address: string;
  image: string;
  availability: "available" | "reserved" | "sold";
  nearby: { name: string; type: string; distanceKm: number }[];
  tags: string[];
  // extended fields from rag_properties
  province: string;
  district: string;
  neighborhood: string;
  developer: string;
  price_per_sqm: number;
  year_built: number;
  nbr_floors: number;
  rental_yield: number | null;
  near_transit: string | null;
  url: string;
};

export type DbPropertyRow = {
  id: string;
  name: string | null;
  property_type: string | null;
  province: string | null;
  district: string | null;
  neighborhood: string | null;
  developer: string | null;
  price_thb: number | null;
  price_per_sqm: number | null;
  year_built: number | null;
  nbr_floors: number | null;
  rental_yield: number | null;
  near_transit: string | null;
  amenities: string[] | null;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  coord_accurate: boolean | null;
  text_content: string | null;
};

function normalizePropertyType(raw: string | null): Property["propertyType"] {
  const t = (raw ?? "").toLowerCase();
  if (t.includes("condo") || t.includes("apartment")) return "condo";
  if (t.includes("townhome") || t.includes("townhouse")) return "townhouse";
  if (t.includes("commercial") || t.includes("retail") || t.includes("office")) return "commercial";
  if (
    t.includes("house") || t.includes("villa") ||
    t.includes("detached") || t.includes("semi-detached")
  ) return "house";
  return "condo";
}

export function rowToProperty(r: DbPropertyRow): Property {
  const amenities = r.amenities ?? [];
  const area_name = r.neighborhood || r.district || r.province || "";
  const address = [r.district, r.province].filter(Boolean).join(", ");

  const nearby: Property["nearby"] = r.near_transit
    ? [{ name: r.near_transit, type: r.near_transit, distanceKm: 0 }]
    : [];

  const description = [
    r.developer ? `โดย ${r.developer}` : "",
    r.year_built ? `สร้างปี ${r.year_built}` : "",
    r.nbr_floors ? `${r.nbr_floors} ชั้น` : "",
    amenities.length ? `สิ่งอำนวยความสะดวก: ${amenities.slice(0, 5).join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  return {
    id: r.id,
    name: r.name ?? "",
    description,
    price: Number(r.price_thb ?? r.price_per_sqm ?? 0),
    listingType: "sale",
    propertyType: normalizePropertyType(r.property_type),
    bedrooms: 0,
    bathrooms: 0,
    area: 0,
    area_name,
    lat: Number(r.latitude ?? 13.7563),
    lng: Number(r.longitude ?? 100.5018),
    address,
    image: "",
    availability: "available",
    nearby,
    tags: amenities,
    province: r.province ?? "",
    district: r.district ?? "",
    neighborhood: r.neighborhood ?? "",
    developer: r.developer ?? "",
    price_per_sqm: Number(r.price_per_sqm ?? 0),
    year_built: Number(r.year_built ?? 0),
    nbr_floors: Number(r.nbr_floors ?? 0),
    rental_yield: r.rental_yield ?? null,
    near_transit: r.near_transit ?? null,
    url: r.url ?? "",
  };
}
