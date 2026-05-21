import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import type { Property } from "@/data/properties";
import { PropertyModal, type ModalPropertyData } from "@/components/PropertyModal";

interface PropertyRowProps {
  title?: string;
  properties: Property[];
  onViewMap?: (id: string) => void;
}

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

function toModalData(p: Property): ModalPropertyData {
  return {
    id: p.id,
    title: p.name,
    description: p.description,
    image: p.image,
    price: p.price,
    tags: p.tags,
    propertyType: p.propertyType,
    bedrooms: p.bedrooms || undefined,
    bathrooms: p.bathrooms || undefined,
    area: p.area || undefined,
    area_name: p.area_name,
  };
}

export function PropertyRow({ title, properties, onViewMap }: PropertyRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTo({
        left: direction === "left" ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75,
        behavior: "smooth",
      });
    }
  };

  if (!properties || properties.length === 0) return null;

  return (
    <div className="relative z-30 pb-10 pt-6 bg-gradient-to-b from-zinc-950 to-background">
      <div className="mx-auto max-w-[1600px] px-6">
        {title && (
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 drop-shadow-md">{title}</h2>
        )}

        <div className="group relative">
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-40 w-12 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 rounded-l-md backdrop-blur-sm"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <div
            ref={scrollContainerRef}
            className="flex gap-2 md:gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {properties.map((property, index) => (
              <div
                key={property.id}
                onClick={() => setSelectedProperty(property)}
                className="relative flex-none w-[160px] md:w-[240px] lg:w-[280px] aspect-video rounded-md overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-50 group/card"
              >
                {/* Gradient background instead of photo */}
                <div className={`absolute inset-0 bg-gradient-to-br ${cardGradient(property.id)} flex items-center justify-center`}>
                  <Building2 className="h-10 w-10 text-white/15" />
                </div>

                {index % 3 === 0 && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    TOP 10
                  </div>
                )}
                {index % 4 === 0 && index % 3 !== 0 && (
                  <div className="absolute top-2 right-2 bg-zinc-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-white/20">
                    NEW
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <h3 className="text-white text-sm font-semibold truncate drop-shadow-md">
                    {property.name}
                  </h3>
                  <div className="text-zinc-300 text-[10px] flex gap-2 items-center mt-1">
                    <span className="font-medium text-green-400 border border-green-400/50 bg-green-400/10 px-1 rounded-sm">
                      ฿{property.price.toLocaleString()}
                    </span>
                    <span className="truncate">{property.area_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-40 w-12 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 rounded-r-md backdrop-blur-sm"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      </div>

      <PropertyModal
        isOpen={!!selectedProperty}
        onClose={() => setSelectedProperty(null)}
        property={selectedProperty ? toModalData(selectedProperty) : null}
        onViewMap={() => selectedProperty && onViewMap?.(selectedProperty.id)}
      />
    </div>
  );
}
