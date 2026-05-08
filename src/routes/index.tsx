import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Building2, MapPin, Sparkles, Heart } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import { FiltersPanel } from "@/components/FiltersPanel";
import { PropertyCard } from "@/components/PropertyCard";
import { filterProperties, type Filters } from "@/lib/filterProperties";

const PropertyMap = lazy(() => import("@/components/PropertyMap").then(m => ({ default: m.PropertyMap })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estate AI — Bangkok Property Assistant" },
      { name: "description", content: "Chat with an AI consultant to discover Bangkok properties matched to your budget, transit, and lifestyle." },
      { property: "og:title", content: "Estate AI — Bangkok Property Assistant" },
      { property: "og:description", content: "AI-powered Bangkok real estate search with smart filters and live map." },
    ],
  }),
  component: Index,
});

function Index() {
  const [filters, setFilters] = useState<Filters>({ listingType: "Any", propertyType: "Any" });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const results = useMemo(() => filterProperties(filters), [filters]);

  const toggleFavorite = (id: string) =>
    setFavorites(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="font-serif text-lg font-semibold leading-tight">Estate AI</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bangkok · powered by AI</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground md:flex">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Conversational property search
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
            <Heart className="h-3.5 w-3.5 text-destructive" />
            {favorites.size} saved
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <section className="border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-[1600px] px-6 py-10 md:py-14">
          <div className="max-w-2xl text-white">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Live AI consultant
            </div>
            <h1 className="font-serif text-3xl font-semibold leading-tight md:text-5xl">
              Find your next Bangkok home<br />
              <span className="text-accent">in conversation.</span>
            </h1>
            <p className="mt-3 text-sm text-white/70 md:text-base">
              Skip the endless filters. Tell our AI what matters — area, budget, BTS, vibe — and watch curated listings appear instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* Left: chat */}
          <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
            <ChatPanel filters={filters} onFiltersChange={setFilters} />
          </div>

          {/* Right: results */}
          <div className="space-y-6">
            {/* Map */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Live Map</span>
                  <span className="text-xs text-muted-foreground">· {results.length} properties</span>
                </div>
              </div>
              <div className="h-[340px] w-full">
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}>
                  <PropertyMap properties={results} focusedId={focusedId} onSelect={setFocusedId} />
                </Suspense>
              </div>
            </div>

            {/* Filters + cards */}
            <div className="grid gap-6 md:grid-cols-[240px_1fr]">
              <div className="md:sticky md:top-24 md:self-start">
                <FiltersPanel filters={filters} onChange={setFilters} />
              </div>

              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-serif text-xl font-semibold">Recommended for you</h2>
                  <span className="text-xs text-muted-foreground">{results.length} matches</span>
                </div>
                {results.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                    <p className="text-sm text-muted-foreground">No properties match these filters yet.</p>
                    <button
                      onClick={() => setFilters({ listingType: "Any", propertyType: "Any" })}
                      className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {results.map(p => (
                      <PropertyCard
                        key={p.id}
                        property={p}
                        isFavorite={favorites.has(p.id)}
                        onToggleFavorite={toggleFavorite}
                        onFocus={setFocusedId}
                        highlighted={focusedId === p.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card/50 py-6">
        <div className="mx-auto max-w-[1600px] px-6 text-center text-xs text-muted-foreground">
          Estate AI · Demo prototype · Property data and locations are illustrative.
        </div>
      </footer>
    </div>
  );
}
