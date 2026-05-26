import { useState, useEffect } from "react";
import { ChevronRight, Image as ImageIcon, Info, Building2, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyModal, type ModalPropertyData } from "@/components/PropertyModal";

const slides = [
  {
    id: 1,
    image: "/hero/luxury_condo.png",
    title: "The Skyline Residence",
    description: "Luxury condo with a rooftop pool overlooking the vibrant Bangkok skyline. Experience modern city living at its finest.",
    tags: ["Condo", "Bangkok", "Rooftop Pool", "Luxury"],
  },
  {
    id: 2,
    image: "/hero/waterfront_mansion.png",
    title: "Riverfront Estate",
    description: "Beautiful modern waterfront mansion with large glass windows, a private dock, and warm elegant lighting.",
    tags: ["Mansion", "Waterfront", "Private Dock", "Premium"],
  },
  {
    id: 3,
    image: "/hero/mountain_resort.png",
    title: "Pine Ridge Retreat",
    description: "High-end luxury mountain resort cabin surrounded by majestic pine trees and serene peaks.",
    tags: ["Resort", "Mountain", "Cabin", "Exclusive"],
  },
];

const STATS = [
  { icon: Building2, value: "53,466", label: "Listings" },
  { icon: MapPin, value: "50+", label: "Districts" },
  { icon: Sparkles, value: "AI", label: "Powered Search" },
];

export function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const handleSelect = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <div className="relative w-full overflow-hidden bg-zinc-950">
      <div className="h-[560px] md:h-[640px] lg:h-[76vh] relative">
        {/* Background Slides */}
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('${slide.image}')`,
                transform: index === currentIndex ? "scale(1.0)" : "scale(1.05)",
                transition: "transform 10000ms linear",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/30 to-transparent" />
          </div>
        ))}

        {/* Content */}
        <div className="relative z-20 mx-auto h-full max-w-[1600px] px-6 py-10 md:py-14 flex flex-col justify-end">
          <div className="max-w-2xl text-white mb-10 md:mb-14">
            <div className="flex flex-wrap gap-2 mb-4">
              {slides[currentIndex].tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-medium backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="font-serif text-4xl font-bold leading-tight md:text-6xl lg:text-7xl mb-4 drop-shadow-md">
              {slides[currentIndex].title}
            </h1>

            <p className="text-base text-zinc-300 md:text-lg mb-8 max-w-xl drop-shadow-sm line-clamp-2">
              {slides[currentIndex].description}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="h-11 px-6 gap-2 bg-white text-zinc-950 hover:bg-zinc-100 font-semibold text-sm rounded-full transition-colors"
                size="lg"
              >
                <ImageIcon className="w-4 h-4" />
                View Gallery
              </Button>
              <Button
                variant="secondary"
                className="h-11 px-6 gap-2 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10 font-semibold text-sm rounded-full transition-colors"
                size="lg"
                onClick={() => setIsModalOpen(true)}
              >
                <Info className="w-4 h-4" />
                Property Details
              </Button>
            </div>
          </div>

          {/* Carousel controls */}
          <div className="absolute bottom-10 md:bottom-14 right-6 flex items-center gap-4">
            <div className="flex gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => handleSelect(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex ? "bg-white w-6" : "bg-white/40 w-2 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/50"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-30 border-t border-white/10 bg-zinc-900/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <div className="flex items-center justify-center gap-8 md:gap-16">
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                  <Icon className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{value}</div>
                  <div className="text-[11px] text-zinc-400">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PropertyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        property={slides[currentIndex] as ModalPropertyData}
        onViewMap={() => document.getElementById('map-container')?.scrollIntoView({ behavior: 'smooth' })}
      />
    </div>
  );
}
