import type { Property } from "@/data/properties";

export type Filters = {
  area?: string;
  propertyType?: Property["propertyType"] | "Any";
  minPrice?: number;
  maxPrice?: number;
  nearTransit?: boolean;
};

export function formatPrice(p: Pick<Property, "price" | "listingType">): string {
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
