import { useEffect } from "react";
import { X, MapPin, BedDouble, Bath, Maximize2, Building, Play, Plus, ThumbsUp } from "lucide-react";
import { Button } from "@/client/components/ui/button";

export interface ModalPropertyData {
  id: string | number;
  title: string;
  description: string;
  image: string;
  price?: number;
  tags?: string[];
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  area_name?: string;
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
        <div className="p-8 grid md:grid-cols-[2fr_1fr] gap-8 text-white/90">
          
          {/* Left Column: Details */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="font-bold text-green-400">
                {property.price ? `฿${property.price.toLocaleString()}` : 'Price upon request'}
              </span>
              <span className="text-white/60">2026</span>
            </div>

            <p className="text-base md:text-lg leading-relaxed text-white/90">
              {property.description}
            </p>

            <div className="grid grid-cols-2 gap-4 text-sm pt-2">
              {property.bedrooms !== undefined && (
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-white/50" />
                  <span>{property.bedrooms} Bedrooms</span>
                </div>
              )}
              {property.bathrooms !== undefined && (
                <div className="flex items-center gap-2">
                  <Bath className="h-4 w-4 text-white/50" />
                  <span>{property.bathrooms} Bathrooms</span>
                </div>
              )}
              {property.area !== undefined && (
                <div className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4 text-white/50" />
                  <span>{property.area} sqm</span>
                </div>
              )}
              {property.propertyType && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-white/50" />
                  <span className="capitalize">{property.propertyType}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Meta & Map */}
          <div className="space-y-6 text-sm">
            {property.tags && property.tags.length > 0 && (
              <div>
                <span className="text-white/50">Highlights: </span>
                <span className="text-white">{property.tags.join(", ")}</span>
              </div>
            )}
            {property.area_name && (
              <div>
                <span className="text-white/50">Location: </span>
                <span className="text-white">{property.area_name}</span>
              </div>
            )}

            {/* Google Map Placeholder */}
            <button 
              onClick={() => {
                onClose();
                onViewMap?.();
              }}
              className="mt-4 w-full rounded-xl overflow-hidden border border-white/10 bg-black/40 text-left transition-transform hover:scale-[1.02]"
            >
              <div className="bg-[#2a2a2e] h-32 w-full relative flex items-center justify-center group">
                <div className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity" style={{ backgroundImage: 'url("https://maps.googleapis.com/maps/api/staticmap?center=Bangkok&zoom=13&size=400x200&maptype=roadmap&style=feature:all|element:labels.text.fill|color:0x8a8a8a&style=feature:all|element:labels.text.stroke|visibility:on|color:0x000000|lightness:16&style=feature:all|element:labels.icon|visibility:off&style=feature:administrative|element:geometry.fill|color:0x000000|lightness:20&style=feature:administrative|element:geometry.stroke|color:0x000000|lightness:17|weight:1.2&style=feature:landscape|element:geometry|color:0x000000|lightness:20&style=feature:poi|element:geometry|color:0x000000|lightness:21&style=feature:road.highway|element:geometry.fill|color:0x000000|lightness:17&style=feature:road.highway|element:geometry.stroke|color:0x000000|lightness:29|weight:0.2&style=feature:road.arterial|element:geometry|color:0x000000|lightness:18&style=feature:road.local|element:geometry|color:0x000000|lightness:16&style=feature:transit|element:geometry|color:0x000000|lightness:19&style=feature:water|element:geometry|color:0x000000|lightness:17")' }} />
                <div className="z-10 flex flex-col items-center gap-1">
                  <MapPin className="h-6 w-6 text-red-500 drop-shadow-lg" />
                  <span className="text-xs font-semibold drop-shadow-md">View on Map</span>
                </div>
              </div>
            </button>
            
          </div>
        </div>
      </div>
    </div>
  );
}
