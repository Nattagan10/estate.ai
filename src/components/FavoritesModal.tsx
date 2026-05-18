import { useEffect, useRef, useState } from "react";
import { X, HeartOff, ChevronLeft, ChevronRight } from "lucide-react";
import type { Property } from "@/data/properties";
import { PropertyModal, type ModalPropertyData } from "@/components/PropertyModal";

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: Property[];
  onRemoveFavorite: (id: string) => void;
  onViewMap?: (id: string) => void;
}

export function FavoritesModal({ isOpen, onClose, favorites, onRemoveFavorite, onViewMap }: FavoritesModalProps) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    // Cleanup function when modal unmounts or closes
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollContainerRef.current.scrollTo({
        left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-[1200px] h-[80vh] flex flex-col bg-[#18181b]/90 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between p-6 border-b border-white/10 bg-black/20">
          <div>
            <h2 className="text-2xl font-serif font-bold text-white">Your Saved Properties</h2>
            <p className="text-sm text-zinc-400 mt-1">{favorites.length} items saved</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white hover:text-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col justify-center relative p-2 md:p-6 overflow-hidden">
          {favorites.length === 0 ? (
            <div className="text-center text-zinc-400">
              <HeartOff className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">You haven't saved any properties yet.</p>
            </div>
          ) : (
            <div className="group relative w-full flex items-center h-full">
              <button onClick={() => scroll("left")} className="absolute left-0 z-10 w-12 h-32 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 rounded-r-xl backdrop-blur-sm -ml-2 md:-ml-6">
                <ChevronLeft className="w-8 h-8" />
              </button>

              <div 
                ref={scrollContainerRef}
                className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory py-10 px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full h-full items-center"
              >
                {favorites.map((prop) => (
                  <div 
                    key={prop.id}
                    className="relative flex-none w-[280px] md:w-[320px] lg:w-[360px] aspect-[3/4.5] rounded-xl overflow-hidden snap-center cursor-pointer transition-all duration-300 hover:-translate-y-6 hover:shadow-2xl hover:shadow-white/10 group/card bg-zinc-800 border border-white/5"
                    onClick={() => setSelectedProperty(prop)}
                  >
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/card:scale-110" style={{ backgroundImage: `url('${prop.image}')` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-[#18181b]/60 to-transparent" />
                    
                    {/* Remove button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveFavorite(prop.id); }}
                      className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-red-500 hover:bg-white transition-colors backdrop-blur-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="absolute bottom-0 w-full p-6 flex flex-col justify-end">
                      <h3 className="text-xl md:text-2xl font-bold text-white mb-2 line-clamp-2 drop-shadow-md">{prop.name}</h3>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-green-400 font-semibold bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded text-sm shadow-sm">
                          ฿{prop.price.toLocaleString()}
                        </span>
                        <span className="text-white/80 text-sm drop-shadow-sm">{prop.area_name}</span>
                      </div>
                      <div className="overflow-hidden transition-all duration-300 max-h-0 opacity-0 group-hover/card:max-h-[100px] group-hover/card:opacity-100">
                        <p className="text-zinc-300 text-sm line-clamp-3 leading-relaxed border-t border-white/20 pt-4">
                          {prop.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => scroll("right")} className="absolute right-0 z-10 w-12 h-32 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 rounded-l-xl backdrop-blur-sm -mr-2 md:-mr-6">
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          )}
        </div>
      </div>

      <PropertyModal 
        isOpen={!!selectedProperty} 
        onClose={() => setSelectedProperty(null)} 
        property={selectedProperty as ModalPropertyData} 
        onViewMap={() => {
          if (selectedProperty) {
            onClose(); // close favorites modal too
            onViewMap?.(selectedProperty.id);
          }
        }}
      />
    </div>
  );
}
