import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Building2,
  MapPin,
  Sparkles,
  Heart,
  X,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Home,
  Building,
  Store,
  BellPlus,
  DollarSign,
  Train,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChatPanel } from "@/components/ChatPanel";
import { PropertyCard } from "@/components/PropertyCard";
import { HeroCarousel } from "@/components/HeroCarousel";
import { PropertyRow } from "@/components/PropertyRow";
import { FavoritesModal } from "@/components/FavoritesModal";
import { PROPERTY_TYPE_LABEL, type Filters } from "@/lib/filterProperties";
import { searchProperties } from "@/lib/properties.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Property } from "@/data/properties";
const PropertyMap = lazy(() =>
  import("@/components/PropertyMap").then((m) => ({ default: m.PropertyMap })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estate AI — Bangkok Property Assistant" },
      {
        name: "description",
        content:
          "Chat with an AI consultant to discover Bangkok properties matched to your budget, transit, and lifestyle.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtersDraft, setFiltersDraft] = useState<Filters>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [locationInput, setLocationInput] = useState("");
  const [typeDraft, setTypeDraft] = useState<Set<Property["propertyType"]>>(new Set());
  const [typeOpen, setTypeOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

  const typesApplied = new Set<Property["propertyType"]>(filters.propertyTypes ?? []);

  useEffect(() => {
    setFiltersDraft(filters);
    setTypeDraft(new Set(filters.propertyTypes ?? []));
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Session is auto-created server-side on first chat message and returned via SSE.
  const startNewChat = () => {
    setSessionId(null);
    setFilters({});
    setTypeDraft(new Set());
    setChatKey((k) => k + 1);
  };

  const ITEMS_PER_PAGE = 50;
  const search = useServerFn(searchProperties);
  const { data, isLoading } = useQuery({
    queryKey: ["properties", filters, page],
    queryFn: () => search({ data: { ...filters, page, limit: ITEMS_PER_PAGE } }),
    placeholderData: (prev) => prev,
  });

  const results = data?.properties ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const paginatedResults = results;
  const favoriteProperties = results.filter(p => favorites.has(p.id));

  const handlePageChange = (p: number) => {
    setIsTransitioning(true);
    setPage(p);
    setTimeout(() => setIsTransitioning(false), 300);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectProperty = (id: string) => {
    setFocusedId(id);
    const index = results.findIndex((p) => p.id === id);
    if (index !== -1) {
      const targetPage = Math.floor(index / ITEMS_PER_PAGE) + 1;
      if (targetPage !== page) {
        setIsTransitioning(true);
        setPage(targetPage);
        setTimeout(() => setIsTransitioning(false), 300);
      }
    }
  };

  const typeOptions: { value: Property["propertyType"]; label: string; icon: any }[] = [
    { value: "house", label: "Single-Family House", icon: Home },
    { value: "condo", label: "Condo / Apartment", icon: Building },
    { value: "townhouse", label: "Townhouse", icon: Building2 },
    { value: "commercial", label: "Commercial", icon: Store },
  ];
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    results.forEach((p) => {
      m[p.propertyType] = (m[p.propertyType] ?? 0) + 1;
    });
    return m;
  }, [results]);

  const isFiltersDirty = useMemo(() => {
    const allKeys = new Set([...Object.keys(filters), ...Object.keys(filtersDraft)]) as Set<keyof Filters>;
    for (const key of allKeys) {
      if (key === "propertyTypes") continue;
      if (filters[key] !== filtersDraft[key]) return true;
    }
    const applied = new Set(filters.propertyTypes ?? []);
    if (typeDraft.size !== applied.size) return true;
    for (const val of typeDraft) {
      if (!applied.has(val)) return true;
    }
    return false;
  }, [filters, filtersDraft, typeDraft]);

  const handleApplyAllFilters = () => {
    setFilters({
      ...filtersDraft,
      propertyTypes: typeDraft.size > 0 ? Array.from(typeDraft) : undefined,
    });
  };

  const toggleTypeDraft = (v: Property["propertyType"]) => {
    setTypeDraft((prev) => {
      const n = new Set(prev);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });
  };
  const applyTypeFilters = () => {
    setTypeOpen(false);
  };
  const clearTypeFilters = () => setTypeDraft(new Set());
  const applyLocation = () => {
    setFilters({ ...filters, area: locationInput.trim() || undefined });
  };

  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (filters.area)
      chips.push({
        label: `Area: ${filters.area}`,
        clear: () => setFilters({ ...filters, area: undefined }),
      });
    if (filters.propertyType && filters.propertyType !== "Any")
      chips.push({
        label: PROPERTY_TYPE_LABEL[filters.propertyType],
        clear: () => setFilters({ ...filters, propertyType: undefined }),
      });
    if (filters.maxPrice != null)
      chips.push({
        label: `≤ ฿${filters.maxPrice.toLocaleString()}`,
        clear: () => setFilters({ ...filters, maxPrice: undefined }),
      });
    if (filters.minPrice != null)
      chips.push({
        label: `≥ ฿${filters.minPrice.toLocaleString()}`,
        clear: () => setFilters({ ...filters, minPrice: undefined }),
      });
    if (filters.nearTransit)
      chips.push({
        label: "Near BTS/MRT",
        clear: () => setFilters({ ...filters, nearTransit: undefined }),
      });
    return chips;
  }, [filters]);

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="font-serif text-lg font-semibold leading-tight">Estate AI</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Bangkok · 53,466 listings · AI
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsFavoritesOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              <Heart className="h-3.5 w-3.5 text-destructive" /> {favorites.size}
            </button>
            <Link
              to="/admin"
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-accent"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </Link>
          </div>
        </div>
      </header>

      <HeroCarousel />
      <PropertyRow 
        properties={results.slice(0, 15)} 
        onViewMap={(id) => {
          handleSelectProperty(id);
          document.getElementById('map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLocation();
              }}
              placeholder="Search by location"
              className="h-12 rounded-full border-border bg-card pl-11 pr-4 text-sm shadow-sm"
            />
          </div>
          <Button
            variant="outline"
            className="h-12 gap-2 rounded-full border-border bg-card px-5 shadow-sm"
          >
            <BellPlus className="h-4 w-4" /> Create alert
          </Button>
        </div>

        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* All filters */}
          <button
            onClick={applyLocation}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary/60"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterChips.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                {activeFilterChips.length}
              </span>
            )}
          </button>

          {/* Property type */}
          <Popover
            open={typeOpen}
            onOpenChange={setTypeOpen}
          >
            <PopoverTrigger asChild>
              <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary/60">
                <Building className="h-4 w-4" />
                {typeDraft.size === 0 ? "Property type" : `Property type · ${typeDraft.size}`}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent style={{ zIndex: 1000 }} align="start" className="w-[320px] p-0">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold">
                Property type
              </div>
              <div className="max-h-[280px] overflow-auto p-2">
                {typeOptions.map(({ value, label, icon: Icon }) => {
                  const checked = typeDraft.has(value);
                  return (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleTypeDraft(value)} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({typeCounts[value] ?? 0})
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                <Button onClick={applyTypeFilters} className="flex-1" size="sm">
                  Apply{typeDraft.size > 0 ? ` (${typeDraft.size})` : ""}
                </Button>
                <Button onClick={clearTypeFilters} variant="ghost" size="sm">
                  Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Price */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary/60">
                <DollarSign className="h-4 w-4" />
                {filtersDraft.maxPrice || filtersDraft.minPrice
                  ? `฿${(filtersDraft.minPrice ?? 0).toLocaleString()} – ${filtersDraft.maxPrice ? "฿" + filtersDraft.maxPrice.toLocaleString() : "∞"}`
                  : "Price"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              style={{ zIndex: 1000 }}
              align="start"
              className="w-[300px] p-4 space-y-3"
            >
              <div className="text-sm font-semibold">Price (THB)</div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtersDraft.minPrice ?? ""}
                  onChange={(e) =>
                    setFiltersDraft({
                      ...filtersDraft,
                      minPrice: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtersDraft.maxPrice ?? ""}
                  onChange={(e) =>
                    setFiltersDraft({
                      ...filtersDraft,
                      maxPrice: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersDraft({ ...filtersDraft, minPrice: undefined, maxPrice: undefined })}
              >
                Clear
              </Button>
            </PopoverContent>
          </Popover>

          {/* Near transit */}
          <button
            onClick={() =>
              setFiltersDraft({ ...filtersDraft, nearTransit: filtersDraft.nearTransit ? undefined : true })
            }
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-sm ${filtersDraft.nearTransit ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary/60"}`}
          >
            <Train className="h-4 w-4" />
            Near BTS / MRT
            {filtersDraft.nearTransit && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
          </button>

          {/* Apply button */}
          <button
            onClick={handleApplyAllFilters}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer ${
              isFiltersDirty
                ? "bg-black text-white hover:bg-neutral-700 ring-2 ring-black/10"
                : "bg-black text-white hover:bg-neutral-700"
            }`}
          >
            Apply
            {isFiltersDirty && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
            )}
          </button>

          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card shadow-sm hover:bg-secondary/60">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6 order-2 lg:order-1">
            <div
              id="map-container"
              className="overflow-hidden rounded-2xl border border-border bg-card"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Live Map</span>
                  <span className="text-xs text-muted-foreground">· {total} matches</span>
                </div>
                {filters.area && (
                  <span className="text-xs font-medium text-destructive">
                    Highlighting {filters.area}
                  </span>
                )}
              </div>
              <div className="h-[340px] w-full">
                <Suspense
                  fallback={
                    <div className="grid h-full place-items-center text-sm text-muted-foreground">
                      Loading map…
                    </div>
                  }
                >
                  <PropertyMap
                    properties={results}
                    focusedId={focusedId}
                    highlightArea={filters.area ?? null}
                    onSelect={handleSelectProperty}
                  />
                </Suspense>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  From chat
                </span>
                {activeFilterChips.map((c) => (
                  <button
                    key={c.label}
                    onClick={c.clear}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium hover:bg-secondary/70"
                  >
                    {c.label} <X className="h-3 w-3" />
                  </button>
                ))}
                <button
                  onClick={() => setFilters({})}
                  className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-serif text-xl font-semibold">Recommended for you</h2>
                <span className="text-xs text-muted-foreground">
                  {isLoading ? "Loading…" : `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, total)} of ${total.toLocaleString()}`}
                </span>
              </div>
              {results.length === 0 && !isLoading ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No properties match yet. Try refining your request in the chat.
                  </p>
                  <button
                    onClick={() => setFilters({})}
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                  >
                    Reset
                  </button>
                </div>
              ) : (
                <div className={`transition-opacity duration-300 ${isTransitioning ? "opacity-50" : "opacity-100"}`}>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {paginatedResults.map((p) => (
                      <PropertyCard
                        key={p.id}
                        property={p}
                        isFavorite={favorites.has(p.id)}
                        onToggleFavorite={toggleFavorite}
                        onFocus={handleSelectProperty}
                        highlighted={focusedId === p.id}
                      />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1 || isTransitioning}
                        className="rounded-full px-4"
                      >
                        Prev
                      </Button>
                      <div className="flex items-center gap-1">
                        {[1, page - 1, page, page + 1, totalPages]
                          .filter((p, i, arr) => p >= 1 && p <= totalPages && arr.indexOf(p) === i)
                          .sort((a, b) => a - b)
                          .map((p, i, arr) => (
                            <>
                              {i > 0 && arr[i - 1] < p - 1 && (
                                <span key={`dots-${p}`} className="text-muted-foreground px-1">…</span>
                              )}
                              <Button
                                key={p}
                                variant={p === page ? "default" : "ghost"}
                                size="sm"
                                className={`h-8 w-8 p-0 rounded-full ${p === page ? "shadow-md" : ""}`}
                                onClick={() => handlePageChange(p)}
                                disabled={isTransitioning}
                              >
                                {p}
                              </Button>
                            </>
                          ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages || isTransitioning}
                        className="rounded-full px-4"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
            <ChatPanel
              key={chatKey}
              filters={filters}
              onFiltersChange={setFilters}
              sessionId={sessionId}
              onSessionChange={setSessionId}
              onNewChat={startNewChat}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card/50 py-6">
        <div className="mx-auto max-w-[1600px] px-6 text-center text-xs text-muted-foreground">
          Estate AI · 53,466 Bangkok listings · AI
        </div>
      </footer>

      <FavoritesModal 
        isOpen={isFavoritesOpen} 
        onClose={() => setIsFavoritesOpen(false)} 
        favorites={favoriteProperties}
        onRemoveFavorite={toggleFavorite}
        onViewMap={(id) => {
          setIsFavoritesOpen(false);
          handleSelectProperty(id);
          document.getElementById('map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />
    </div>
  );
}
