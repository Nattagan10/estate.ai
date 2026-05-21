import type { Property } from "@/data/properties";

export type Filters = {
  area?: string;
  propertyType?: Property["propertyType"] | "Any";
  listingType?: Property["listingType"] | "Any";
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  nearTransit?: boolean;
  nearUniversity?: boolean;
  nearMall?: boolean;
  availability?: Property["availability"];
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
