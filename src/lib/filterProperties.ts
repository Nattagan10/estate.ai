import { PROPERTIES, type Property } from "@/data/properties";

export type Filters = {
  query?: string;
  area?: string;
  propertyType?: Property["propertyType"] | "Any";
  listingType?: Property["listingType"] | "Any";
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  nearTransit?: boolean;
  nearUniversity?: boolean;
  nearMall?: boolean;
};

export function filterProperties(f: Filters): Property[] {
  return PROPERTIES.filter((p) => {
    if (f.area && !p.area_name.toLowerCase().includes(f.area.toLowerCase()) &&
        !p.name.toLowerCase().includes(f.area.toLowerCase())) return false;
    if (f.query) {
      const q = f.query.toLowerCase();
      const hay = `${p.name} ${p.description} ${p.area_name} ${p.tags.join(" ")} ${p.nearby.map(n=>n.name).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.propertyType && f.propertyType !== "Any" && p.propertyType !== f.propertyType) return false;
    if (f.listingType && f.listingType !== "Any" && p.listingType !== f.listingType) return false;
    if (f.minPrice != null && p.price < f.minPrice) return false;
    if (f.maxPrice != null && p.price > f.maxPrice) return false;
    if (f.bedrooms != null && p.bedrooms < f.bedrooms) return false;
    if (f.nearTransit && !p.nearby.some(n => (n.type === "BTS" || n.type === "MRT") && n.distanceKm <= 0.6)) return false;
    if (f.nearUniversity && !p.nearby.some(n => n.type === "University" && n.distanceKm <= 1.2)) return false;
    if (f.nearMall && !p.nearby.some(n => n.type === "Mall" && n.distanceKm <= 0.6)) return false;
    return true;
  });
}

export function formatPrice(p: Property): string {
  if (p.listingType === "rent") {
    return `฿${p.price.toLocaleString()}/mo`;
  }
  return `฿${(p.price / 1_000_000).toFixed(2)}M`;
}