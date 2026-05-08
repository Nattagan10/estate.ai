import { MapPin, Bed, Bath, Maximize, Train, Heart } from "lucide-react";
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

export function PropertyCard({ property, isFavorite, onToggleFavorite, onFocus, highlighted }: Props) {
  const transit = property.nearby.find(n => n.type === "BTS" || n.type === "MRT");
  return (
    <div
      onClick={() => onFocus(property.id)}
      className={`group cursor-pointer rounded-2xl bg-card overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 ${
        highlighted ? "ring-2 ring-accent shadow-[var(--shadow-glow)]" : "border-border"
      }`}
      style={{ boxShadow: highlighted ? undefined : "var(--shadow-card)" }}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={property.image}
          alt={property.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent" />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(property.id); }}
          aria-label="Favorite"
          className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 backdrop-blur transition hover:scale-110"
        >
          <Heart className={`h-4 w-4 ${isFavorite ? "fill-destructive text-destructive" : "text-foreground"}`} />
        </button>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <Badge className="bg-accent text-accent-foreground hover:bg-accent border-0 font-medium">
            {property.listingType === "rent" ? "For Rent" : "For Sale"}
          </Badge>
          {transit && (
            <Badge className="bg-white/90 text-foreground hover:bg-white border-0">
              <Train className="mr-1 h-3 w-3" /> {transit.distanceKm <= 0.3 ? "Steps to" : `${transit.distanceKm}km to`} {transit.name}
            </Badge>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold leading-tight">{property.name}</h3>
          <div className="text-right">
            <div className="text-lg font-semibold text-primary">{formatPrice(property)}</div>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {property.area_name}, Bangkok
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{property.description}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-foreground/70">
          {property.bedrooms > 0 && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {property.bedrooms}</span>}
          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {property.bathrooms}</span>
          <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {property.area} m²</span>
        </div>
      </div>
    </div>
  );
}