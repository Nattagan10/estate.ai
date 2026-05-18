import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Property } from "@/data/properties";
import { PropertyModal, type ModalPropertyData } from "@/components/PropertyModal";

interface PropertyRowProps {
  title?: string;
  properties: Property[];
  onViewMap?: (id: string) => void;
}

export function PropertyRow({ title, properties, onViewMap }: PropertyRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollAmount = clientWidth * 0.75; // Scroll 75% of container width
      
      scrollContainerRef.current.scrollTo({
        left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!properties || properties.length === 0) return null;

  return (
    <div className="relative z-30 pb-10 pt-6 bg-gradient-to-b from-zinc-950 to-background">
      <div className="mx-auto max-w-[1600px] px-6">
        {title && (
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 drop-shadow-md">
            {title}
          </h2>
        )}
        
        <div className="group relative">
          {/* Left Arrow */}
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-40 w-12 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 rounded-l-md backdrop-blur-sm"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          {/* Scroll Container */}
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
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${property.image}')` }}
                />
                
                {/* Netflix-style tag (e.g. Recently Added) */}
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

                {/* Bottom Gradient and Info (appears on hover) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <h3 className="text-white text-sm font-semibold truncate drop-shadow-md">
                    {property.name}
                  </h3>
                  <div className="text-zinc-300 text-[10px] flex gap-2 items-center mt-1">
                    <span className="font-medium text-green-400 border border-green-400/50 bg-green-400/10 px-1 rounded-sm">
                      ฿{property.price.toLocaleString()}
                    </span>
                    <span>{property.area_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Arrow */}
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
        property={selectedProperty as ModalPropertyData} 
        onViewMap={() => selectedProperty && onViewMap?.(selectedProperty.id)}
      />
    </div>
  );
}
