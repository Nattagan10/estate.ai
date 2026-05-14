import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { Building2, MapPin, Sparkles, Heart, X, ShieldCheck, Search, SlidersHorizontal, ChevronDown, Home, Building, Store, Trees, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChatPanel } from "@/components/ChatPanel";
import { PropertyCard } from "@/components/PropertyCard";
import { PROPERTY_TYPE_LABEL, type Filters } from "@/lib/filterProperties";
import { searchProperties } from "@/lib/properties.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Property } from "@/data/properties";
const PropertyMap = lazy(() => import("@/components/PropertyMap").then((m) => ({ default: m.PropertyMap })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estate AI — Bangkok Property Assistant" },
      { name: "description", content: "Chat with an AI consultant to discover Bangkok properties matched to your budget, transit, and lifestyle." },
    ],
  }),
  component: Index,
});

function Index() {
  const [filters, setFilters] = useState<Filters>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [locationInput, setLocationInput] = useState("");
  const [typeDraft, setTypeDraft] = useState<Set<Property["propertyType"]>>(new Set());
  const [typesApplied, setTypesApplied] = useState<Set<Property["propertyType"]>>(new Set());
  const [typeOpen, setTypeOpen] = useState(false);

  // Session is auto-created server-side on first chat message and returned via SSE.
  const startNewChat = () => {
    setSessionId(null);
    setFilters({});
    setChatKey((k) => k + 1);
  };

  const search = useServerFn(searchProperties);
  const { data, isLoading } = useQuery({
    queryKey: ["properties", filters],
    queryFn: () => search({ data: { ...filters, limit: 60 } }),
    placeholderData: (prev) => prev,
  });

  const allResults = data?.properties ?? [];
  const results = typesApplied.size > 0 ? allResults.filter((p) => typesApplied.has(p.propertyType)) : allResults;
  const total = typesApplied.size > 0 ? results.length : (data?.total ?? 0);

  const typeOptions: { value: Property["propertyType"]; label: string; icon: any }[] = [
    { value: "house", label: "Single-Family House", icon: Home },
    { value: "condo", label: "Condo / Apartment", icon: Building },
    { value: "townhouse", label: "Townhouse", icon: Building2 },
    { value: "commercial", label: "Commercial", icon: Store },
  ];
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    allResults.forEach((p) => { m[p.propertyType] = (m[p.propertyType] ?? 0) + 1; });
    return m;
  }, [allResults]);

  const toggleTypeDraft = (v: Property["propertyType"]) => {
    setTypeDraft((prev) => {
      const n = new Set(prev);
      if (n.has(v)) n.delete(v); else n.add(v);
      return n;
    });
  };
  const applyTypeFilters = () => {
    setTypesApplied(new Set(typeDraft));
    setTypeOpen(false);
  };
  const clearTypeFilters = () => {
    setTypeDraft(new Set());
    setTypesApplied(new Set());
  };
  const applyLocation = () => {
    setFilters({ ...filters, area: locationInput.trim() || undefined });
  };

  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (filters.area) chips.push({ label: `Area: ${filters.area}`, clear: () => setFilters({ ...filters, area: undefined }) });
    if (filters.propertyType && filters.propertyType !== "Any")
      chips.push({ label: PROPERTY_TYPE_LABEL[filters.propertyType], clear: () => setFilters({ ...filters, propertyType: undefined }) });
    if (filters.listingType && filters.listingType !== "Any")
      chips.push({ label: `For ${filters.listingType}`, clear: () => setFilters({ ...filters, listingType: undefined }) });
    if (filters.bedrooms != null) chips.push({ label: `${filters.bedrooms}+ bed`, clear: () => setFilters({ ...filters, bedrooms: undefined }) });
    if (filters.maxPrice != null) chips.push({ label: `≤ ฿${filters.maxPrice.toLocaleString()}`, clear: () => setFilters({ ...filters, maxPrice: undefined }) });
    if (filters.minPrice != null) chips.push({ label: `≥ ฿${filters.minPrice.toLocaleString()}`, clear: () => setFilters({ ...filters, minPrice: undefined }) });
    if (filters.nearTransit) chips.push({ label: "Near BTS/MRT", clear: () => setFilters({ ...filters, nearTransit: undefined }) });
    if (filters.nearUniversity) chips.push({ label: "Near University", clear: () => setFilters({ ...filters, nearUniversity: undefined }) });
    if (filters.nearMall) chips.push({ label: "Near Mall", clear: () => setFilters({ ...filters, nearMall: undefined }) });
    return chips;
  }, [filters]);

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
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
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bangkok · 500 listings · AI</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground md:flex">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Conversational property search
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
              <Heart className="h-3.5 w-3.5 text-destructive" /> {favorites.size}
            </div>
            <Link to="/admin" className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-accent">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-[1600px] px-6 py-10 md:py-14">
          <div className="max-w-2xl text-foreground">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" /> Live AI consultant
            </div>
            <h1 className="font-serif text-3xl font-semibold leading-tight md:text-5xl">
              Find your next Bangkok home<br />
              <span className="text-muted-foreground">in conversation.</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Tell our AI what matters — area, budget, BTS, vibe — and watch listings narrow from 500 to your perfect match.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 md:flex-row md:items-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyLocation(); }}
              placeholder="Search by Location (e.g., Sukhumvit, Sathorn)"
              className="h-11 rounded-xl border-border bg-background pl-9"
            />
          </div>
          <Popover open={typeOpen} onOpenChange={(o) => { setTypeOpen(o); if (o) setTypeDraft(new Set(typesApplied)); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 justify-between gap-2 rounded-xl md:w-[220px]">
                <span className="truncate text-sm">
                  {typesApplied.size === 0 ? "Property Type" : `${typesApplied.size} type${typesApplied.size > 1 ? "s" : ""} selected`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[340px] p-0">
              <div className="border-b border-border px-4 py-3">
                <div className="text-sm font-semibold">Select Property Types</div>
              </div>
              <div className="max-h-[280px] overflow-auto p-2">
                {typeOptions.map(({ value, label, icon: Icon }) => {
                  const checked = typeDraft.has(value);
                  return (
                    <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60">
                      <Checkbox checked={checked} onCheckedChange={() => toggleTypeDraft(value)} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{label}</span>
                      <span className="text-xs text-muted-foreground">({typeCounts[value] ?? 0})</span>
                    </label>
                  );
                })}
              </div>
              {typeDraft.size > 0 && (
                <div className="border-t border-border px-4 py-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Selected Types</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(typeDraft).map((v) => (
                      <button
                        key={v}
                        onClick={() => toggleTypeDraft(v)}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/70"
                      >
                        {typeOptions.find((o) => o.value === v)?.label}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                <Button onClick={applyTypeFilters} className="flex-1" size="sm">
                  Apply Filters{typeDraft.size > 0 ? ` (${typeDraft.size})` : ""}
                </Button>
                <Button onClick={clearTypeFilters} variant="ghost" size="sm">Clear All</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={applyLocation} className="h-11 gap-2 rounded-xl md:w-auto">
            <SlidersHorizontal className="h-4 w-4" /> Filter
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6 order-2 lg:order-1">
            <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Live Map</span>
                  <span className="text-xs text-muted-foreground">· {total} matches</span>
                </div>
                {filters.area && <span className="text-xs font-medium text-destructive">Highlighting {filters.area}</span>}
              </div>
              <div className="h-[340px] w-full">
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}>
                  <PropertyMap properties={results} focusedId={focusedId} highlightArea={filters.area ?? null} onSelect={setFocusedId} />
                </Suspense>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">From chat</span>
                {activeFilterChips.map((c) => (
                  <button key={c.label} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium hover:bg-secondary/70">
                    {c.label} <X className="h-3 w-3" />
                  </button>
                ))}
                <button onClick={() => setFilters({})} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">
                  Clear all
                </button>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-serif text-xl font-semibold">Recommended for you</h2>
                <span className="text-xs text-muted-foreground">{isLoading ? "Loading…" : `${results.length} of ${total}`}</span>
              </div>
              {results.length === 0 && !isLoading ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">No properties match yet. Try refining your request in the chat.</p>
                  <button onClick={() => setFilters({})} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                    Reset
                  </button>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((p) => (
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
          Estate AI · Demo prototype · 500 mock Bangkok listings
        </div>
      </footer>
    </div>
  );
}
