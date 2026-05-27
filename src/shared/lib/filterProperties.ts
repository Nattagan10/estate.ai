import type { Property } from "@/shared/data/properties";

export type Filters = {
  area?: string;
  propertyType?: Property["propertyType"] | "Any";
  propertyTypes?: Property["propertyType"][];
  minPrice?: number;
  maxPrice?: number;
  nearTransit?: boolean;
  sortBy?: "price_asc" | "price_desc" | "newest" | "yield";
  minYearBuilt?: number;
  hasYield?: boolean;
  // Distance filter
  lat?: number;
  lng?: number;
  maxDistanceM?: number;
};

export function formatPrice(p: { price?: number | null }): string {
  if (!p.price) return "ราคาตามตกลง";
  if (p.price >= 1_000_000) return `฿${(p.price / 1_000_000).toFixed(1)}M`;
  return `฿${p.price.toLocaleString()}`;
}

export const PROPERTY_TYPE_LABEL: Record<Property["propertyType"], string> = {
  condo: "Condo",
  house: "House",
  townhouse: "Townhouse",
  commercial: "Commercial",
};
