import { MapPin, Train, Heart, Building2, TrendingUp, BedDouble, Bath, Maximize2 } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { type Property } from "@/shared/data/properties";
import { formatPrice } from "@/shared/lib/filterProperties";

type Props = {
  property: Property;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onFocus: (id: string) => void;
  onDetail: (property: Property) => void;
  highlighted?: boolean;
};

const GRADIENT_PALETTE = [
  "from-violet-900 to-indigo-900",
  "from-emerald-900 to-teal-900",
  "from-rose-900 to-pink-900",
  "from-amber-900 to-orange-900",
  "from-sky-900 to-cyan-900",
  "from-fuchsia-900 to-purple-900",
];

function cardGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENT_PALETTE[hash % GRADIENT_PALETTE.length];
}

export function PropertyCard({
  property,
  isFavorite,
  onToggleFavorite,
  onFocus,
  onDetail,
  highlighted,
}: Props) {
  const transit = property.near_transit;
  const location = [property.neighborhood || property.district, property.province]
    .filter(Boolean)
    .join(", ");
  const isRent = property.listingType === "rent";

  return (
    <div
      onClick={() => onDetail(property)}
      className={`group cursor-pointer rounded-2xl bg-card overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        highlighted ? "ring-2 ring-accent shadow-[var(--shadow-glow)]" : "border-border"
      }`}
      style={{ boxShadow: highlighted ? undefined : "var(--shadow-card)" }}
    >
      {/* Hero gradient */}
      <div className={`relative aspect-[16/10] bg-gradient-to-br ${cardGradient(property.id)} flex items-center justify-center`}>
        <Building2 className="h-12 w-12 text-white/20" />

        {/* Listing type pill — top left */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              isRent
                ? "bg-blue-500/90 text-white"
                : "bg-emerald-500/90 text-white"
            }`}
          >
            {isRent ? "For Rent" : "For Sale"}
          </span>
        </div>

        {/* Favorite — top right */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(property.id); }}
          aria-label="Favorite"
          className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 backdrop-blur transition hover:scale-110"
        >
          <Heart className={`h-4 w-4 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-foreground/70"}`} />
        </button>

        {/* Bottom badges */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <Badge className="bg-black/60 text-white hover:bg-black/60 border-0 font-medium capitalize backdrop-blur-sm">
            {property.propertyType}
          </Badge>
          {transit && (
            <Badge className="bg-white/90 text-foreground hover:bg-white border-0 backdrop-blur-sm">
              <Train className="mr-1 h-3 w-3" /> {transit}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Name + Price */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-base font-semibold leading-tight line-clamp-2 flex-1">{property.name}</h3>
          <div className="text-right shrink-0 ml-2">
            <div className="text-base font-bold text-foreground">{formatPrice(property)}</div>
            {property.price_per_sqm > 0 && (
              <div className="text-[11px] text-muted-foreground">฿{property.price_per_sqm.toLocaleString()}/sqm</div>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
          <span className="truncate">{location || "Bangkok"}</span>
        </div>

        {/* Spec pills: beds / baths / sqm */}
        <div className="mt-3 flex items-center gap-3 text-xs">
          {property.bedrooms > 0 && (
            <span className="flex items-center gap-1 text-foreground/80">
              <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
              {property.bedrooms} bed
            </span>
          )}
          {property.bathrooms > 0 && (
            <span className="flex items-center gap-1 text-foreground/80">
              <Bath className="h-3.5 w-3.5 text-muted-foreground" />
              {property.bathrooms} bath
            </span>
          )}
          {property.area > 0 && (
            <span className="flex items-center gap-1 text-foreground/80">
              <Maximize2 className="h-3 w-3 text-muted-foreground" />
              {property.area.toLocaleString()} sqm
            </span>
          )}
          {property.rental_yield != null && (
            <span className="flex items-center gap-0.5 text-emerald-600 font-medium ml-auto">
              <TrendingUp className="h-3 w-3" /> {property.rental_yield}%
            </span>
          )}
        </div>

        {/* Developer + year */}
        {(property.developer || property.year_built > 0) && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            {property.developer && <span className="truncate">{property.developer}</span>}
            {property.year_built > 0 && (
              <span className="shrink-0 ml-auto">Est. {property.year_built}</span>
            )}
          </div>
        )}

        {/* Tags */}
        {property.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {property.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <button
            onClick={(e) => { e.stopPropagation(); onFocus(property.id); document.getElementById("map-container")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-accent transition-colors"
          >
            <MapPin className="h-3 w-3" /> View on Map
          </button>
          <span className="text-[11px] text-muted-foreground/50">คลิกดูรายละเอียด →</span>
        </div>
      </div>
    </div>
  );
}
