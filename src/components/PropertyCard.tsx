import { MapPin, Train, Heart, Building2, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Property } from "@/data/properties";
import { formatPrice } from "@/lib/filterProperties";

type Props = {
  property: Property;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onFocus: (id: string) => void;
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
  highlighted,
}: Props) {
  const transit = property.near_transit;
  const location = [property.neighborhood || property.district, property.province]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      onClick={() => onFocus(property.id)}
      className={`group cursor-pointer rounded-2xl bg-card overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 ${
        highlighted ? "ring-2 ring-accent shadow-[var(--shadow-glow)]" : "border-border"
      }`}
      style={{ boxShadow: highlighted ? undefined : "var(--shadow-card)" }}
    >
      {/* Hero — gradient with property type icon (no photo in dataset) */}
      <div className={`relative aspect-[16/10] bg-gradient-to-br ${cardGradient(property.id)} flex items-center justify-center`}>
        <Building2 className="h-12 w-12 text-white/20" />

        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(property.id); }}
          aria-label="Favorite"
          className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 backdrop-blur transition hover:scale-110"
        >
          <Heart className={`h-4 w-4 ${isFavorite ? "fill-destructive text-destructive" : "text-foreground"}`} />
        </button>

        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <Badge className="bg-accent text-accent-foreground hover:bg-accent border-0 font-medium capitalize">
            {property.propertyType}
          </Badge>
          {transit && (
            <Badge className="bg-white/90 text-foreground hover:bg-white border-0">
              <Train className="mr-1 h-3 w-3" /> {transit}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold leading-tight line-clamp-2">{property.name}</h3>
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold text-primary">{formatPrice(property)}</div>
            {property.price_per_sqm > 0 && (
              <div className="text-xs text-muted-foreground">฿{property.price_per_sqm.toLocaleString()}/sqm</div>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{location || "Bangkok"}</span>
        </div>

        {property.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{property.description}</p>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-foreground/70 flex-wrap">
          {property.year_built > 0 && <span>Built {property.year_built}</span>}
          {property.nbr_floors > 0 && <span>{property.nbr_floors} floors</span>}
          {property.rental_yield != null && (
            <span className="flex items-center gap-0.5 text-emerald-500">
              <TrendingUp className="h-3 w-3" /> {property.rental_yield}% yield
            </span>
          )}
        </div>

        {property.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {property.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
