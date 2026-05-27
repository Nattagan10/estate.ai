import { useEffect } from "react";
import { X, MapPin, BedDouble, Bath, Maximize2, Building, TrendingUp, Train, ExternalLink, CalendarDays, Layers } from "lucide-react";
import { Button } from "@/client/components/ui/button";

export interface ModalPropertyData {
  id: string | number;
  title: string;
  description: string;
  image: string;
  price?: number;
  price_per_sqm?: number;
  tags?: string[];
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  area_name?: string;
  // extended
  developer?: string;
  year_built?: number;
  nbr_floors?: number;
  rental_yield?: number | null;
  near_transit?: string | null;
  district?: string;
  province?: string;
  url?: string;
}

interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: ModalPropertyData | null;
  onViewMap?: () => void;
}

export function PropertyModal({ isOpen, onClose, property, onViewMap }: PropertyModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !property) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-[850px] max-h-[90vh] overflow-y-auto bg-[#18181b] rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-[#18181b]/50 text-white transition-colors hover:bg-white hover:text-black backdrop-blur-md"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Hero Banner */}
        <div className="relative h-[300px] md:h-[450px] w-full">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${property.image}')` }}
          />
          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#18181b]/80 via-transparent to-transparent" />
          
          {/* Banner Content */}
          <div className="absolute bottom-0 left-0 p-8 w-full">
            <h2 className="font-serif text-3xl md:text-5xl font-bold text-white drop-shadow-lg max-w-2xl">
              {property.title}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 grid md:grid-cols-[2fr_1fr] gap-8 text-white/90">

          {/* Left Column */}
          <div className="space-y-6">
            {/* Price row */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-bold text-green-400">
                {property.price ? `฿${property.price.toLocaleString()}` : "Price upon request"}
              </span>
              {property.price_per_sqm && property.price_per_sqm > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
                  ฿{property.price_per_sqm.toLocaleString()} / sqm
                </span>
              )}
              {property.rental_yield != null && property.rental_yield > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                  <TrendingUp className="h-3 w-3" /> {property.rental_yield}% yield
                </span>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <p className="text-sm md:text-base leading-relaxed text-white/80">{property.description}</p>
            )}

            {/* Spec grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {property.propertyType && (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <Building className="h-4 w-4 text-white/40 shrink-0" />
                  <span className="capitalize">{property.propertyType}</span>
                </div>
              )}
              {property.year_built && property.year_built > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <CalendarDays className="h-4 w-4 text-white/40 shrink-0" />
                  <span>Built {property.year_built}</span>
                </div>
              )}
              {property.nbr_floors && property.nbr_floors > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <Layers className="h-4 w-4 text-white/40 shrink-0" />
                  <span>{property.nbr_floors} floors</span>
                </div>
              )}
              {property.near_transit && (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <Train className="h-4 w-4 text-white/40 shrink-0" />
                  <span className="truncate">{property.near_transit}</span>
                </div>
              )}
              {property.bedrooms != null && property.bedrooms > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <BedDouble className="h-4 w-4 text-white/40 shrink-0" />
                  <span>{property.bedrooms} beds</span>
                </div>
              )}
              {property.bathrooms != null && property.bathrooms > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <Bath className="h-4 w-4 text-white/40 shrink-0" />
                  <span>{property.bathrooms} baths</span>
                </div>
              )}
              {property.area != null && property.area > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <Maximize2 className="h-4 w-4 text-white/40 shrink-0" />
                  <span>{property.area.toLocaleString()} sqm</span>
                </div>
              )}
            </div>

            {/* Amenities */}
            {property.tags && property.tags.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {property.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 capitalize">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4 text-sm">
            {/* Location info */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Location</p>
              {property.area_name && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
                  <span>{property.area_name}</span>
                </div>
              )}
              {property.district && (
                <div className="flex items-center gap-2 text-white/60">
                  <span className="ml-6">เขต {property.district}</span>
                </div>
              )}
              {property.province && (
                <div className="flex items-center gap-2 text-white/60">
                  <span className="ml-6">{property.province}</span>
                </div>
              )}
              {property.developer && (
                <div className="mt-3 border-t border-white/10 pt-3 text-white/60">
                  <span className="text-white/40">Developer: </span>{property.developer}
                </div>
              )}
            </div>

            {/* View on Map button */}
            {onViewMap && (
              <button
                onClick={() => { onClose(); onViewMap(); }}
                className="w-full rounded-xl overflow-hidden border border-white/10 bg-black/40 transition-transform hover:scale-[1.02]"
              >
                <div className="h-28 w-full relative flex items-center justify-center group bg-[#2a2a2e]">
                  <div className="z-10 flex flex-col items-center gap-1">
                    <MapPin className="h-6 w-6 text-red-500 drop-shadow-lg" />
                    <span className="text-xs font-semibold drop-shadow-md">View on Map</span>
                  </div>
                </div>
              </button>
            )}

            {/* External link to listing */}
            {property.url && (
              <a
                href={property.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4" />
                ดูรายละเอียดต้นทาง
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
