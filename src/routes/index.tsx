import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/client/components/ui/sonner";
import {
  Building2,
  MapPin,
  Sparkles,
  Heart,
  X,
  ShieldCheck,
  Search,
  ChevronDown,
  Home,
  Building,
  Store,
  BellPlus,
  DollarSign,
  Train,
  TrendingUp,
  CalendarDays,
  ArrowUpDown,
  Check,
  Navigation,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChatPanel } from "@/client/components/ChatPanel";
import { PropertyCard } from "@/client/components/PropertyCard";
import { HeroCarousel } from "@/client/components/HeroCarousel";
import { FavoritesModal } from "@/client/components/FavoritesModal";
import { PropertyModal } from "@/client/components/PropertyModal";
import { PROPERTY_TYPE_LABEL, type Filters } from "@/shared/lib/filterProperties";
import { searchProperties, fetchMapPins } from "@/functions/properties";
import { Popover, PopoverContent, PopoverTrigger } from "@/client/components/ui/popover";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Button } from "@/client/components/ui/button";
import type { Property } from "@/shared/data/properties";
const PropertyMap = lazy(() =>
  import("@/client/components/PropertyMap").then((m) => ({ default: m.PropertyMap })),
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
  const [favoriteItems, setFavoriteItems] = useState<Property[]>([]);
  const favorites = useMemo(() => new Set(favoriteItems.map((p) => p.id)), [favoriteItems]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [locationInput, setLocationInput] = useState("");
  const [typeDraft, setTypeDraft] = useState<Set<Property["propertyType"]>>(new Set());
  const [typeOpen, setTypeOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [ragResults, setRagResults] = useState<Property[] | null>(null);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<{ lat: number; lng: number; maxDistanceM?: number } | null>(null);
  const [anchorInput, setAnchorInput] = useState({ lat: "", lng: "", dist: "" });
  const [anchorPanelOpen, setAnchorPanelOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("estate_favorites");
      if (saved) setFavoriteItems(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    setFiltersDraft(filters);
    setTypeDraft(new Set(filters.propertyTypes ?? []));
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [filters]);


  // Session is auto-created server-side on first chat message and returned via SSE.
  const startNewChat = () => {
    try {
      localStorage.removeItem("estate_session_id");
      localStorage.removeItem("estate_chat_messages");
    } catch {}
    setSessionId(null);
    setFilters({});
    setTypeDraft(new Set());
    setRagResults(null);
    setChatKey((k) => k + 1);
  };

  const ITEMS_PER_PAGE = 50;
  const search = useServerFn(searchProperties);
  const mapSearch = useServerFn(fetchMapPins);

  const hasActiveFilters = !!(
    filters.area ||
    (filters.propertyTypes && filters.propertyTypes.length > 0) ||
    (filters.propertyType && filters.propertyType !== "Any") ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.nearTransit ||
    filters.minYearBuilt != null ||
    filters.hasYield ||
    filters.sortBy
  );

  const { data, isLoading } = useQuery({
    queryKey: ["properties", filters, page, anchorPoint],
    queryFn: () => search({ data: { ...filters, ...anchorPoint ?? {}, page, limit: ITEMS_PER_PAGE } }),
    enabled: hasActiveFilters || !!anchorPoint,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const { data: mapData } = useQuery({
    queryKey: ["map-pins", filters, anchorPoint],
    queryFn: () => mapSearch({ data: { ...filters, ...anchorPoint ?? {} } }),
    enabled: hasActiveFilters || !!anchorPoint,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const mapPins = hasActiveFilters ? (mapData?.pins ?? []) : [];

  const results = data?.properties ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const paginatedResults = results;
  const favoriteProperties = favoriteItems;

  const handlePageChange = (p: number) => {
    setIsTransitioning(true);
    setPage(p);
    setTimeout(() => setIsTransitioning(false), 300);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectProperty = (id: string) => {
    setFocusedId(id);
    // If the selected property is not on the current page, go to page 1 so the user
    // can see the card list update — the map pin is already highlighted regardless.
    const onCurrentPage = results.some((p) => p.id === id);
    if (!onCurrentPage && page !== 1) {
      setIsTransitioning(true);
      setPage(1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const typeOptions: { value: Property["propertyType"]; label: string; icon: any }[] = [
    { value: "condo", label: "คอนโด / อพาร์ตเมนต์", icon: Building },
    { value: "house", label: "บ้านเดี่ยว", icon: Home },
    { value: "townhouse", label: "ทาวน์เฮ้าส์", icon: Building2 },
    { value: "commercial", label: "อาคารพาณิชย์", icon: Store },
  ];

  const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
    { label: "< 1M",    max: 1_000_000 },
    { label: "1–3M",    min: 1_000_000,  max: 3_000_000 },
    { label: "3–5M",    min: 3_000_000,  max: 5_000_000 },
    { label: "5–10M",   min: 5_000_000,  max: 10_000_000 },
    { label: "10M+",    min: 10_000_000 },
  ];

  const YEAR_PRESETS: { label: string; minYear?: number }[] = [
    { label: "ทุกช่วง" },
    { label: "ใหม่ (2022+)",    minYear: 2022 },
    { label: "ล่าสุด (2018+)",  minYear: 2018 },
    { label: "ก่อน 2018",       minYear: undefined },
  ];

  const SORT_OPTIONS: { label: string; value: Filters["sortBy"] | undefined; icon: string }[] = [
    { label: "Best match",         value: undefined,       icon: "✨" },
    { label: "ราคา: ต่ำ → สูง",   value: "price_asc",     icon: "↑" },
    { label: "ราคา: สูง → ต่ำ",   value: "price_desc",    icon: "↓" },
    { label: "สร้างใหม่ที่สุด",   value: "newest",        icon: "🏗️" },
    { label: "ผลตอบแทนสูงสุด",    value: "yield",         icon: "📈" },
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
      area: locationInput.trim() || filtersDraft.area,
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
  const applyLocation = () => {
    setFilters({ ...filters, area: locationInput.trim() || undefined });
  };

  const setPricePreset = (min?: number, max?: number) => {
    setFiltersDraft((d) => ({ ...d, minPrice: min, maxPrice: max }));
  };

  const activePricePreset = PRICE_PRESETS.find(
    (p) => p.min === filtersDraft.minPrice && p.max === filtersDraft.maxPrice,
  );

  const activeYearPreset = filtersDraft.minYearBuilt === 2022
    ? YEAR_PRESETS[1] : filtersDraft.minYearBuilt === 2018
    ? YEAR_PRESETS[2] : YEAR_PRESETS[0];

  const activeSortOption = SORT_OPTIONS.find((s) => s.value === filtersDraft.sortBy) ?? SORT_OPTIONS[0];

  const priceLabel = (() => {
    if (filtersDraft.minPrice != null && filtersDraft.maxPrice != null)
      return `฿${(filtersDraft.minPrice/1e6).toFixed(0)}M – ฿${(filtersDraft.maxPrice/1e6).toFixed(0)}M`;
    if (filtersDraft.minPrice != null)
      return `฿${(filtersDraft.minPrice/1e6).toFixed(0)}M+`;
    if (filtersDraft.maxPrice != null)
      return `< ฿${(filtersDraft.maxPrice/1e6).toFixed(0)}M`;
    return "ราคา";
  })();

  const activeFilterChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (filters.area)
      chips.push({ label: `📍 ${filters.area}`, clear: () => setFilters({ ...filters, area: undefined }) });
    if (filters.propertyTypes?.length)
      chips.push({ label: filters.propertyTypes.map((t) => PROPERTY_TYPE_LABEL[t]).join(", "), clear: () => setFilters({ ...filters, propertyTypes: undefined }) });
    if (filters.maxPrice != null || filters.minPrice != null) {
      const min = filters.minPrice, max = filters.maxPrice;
      const lbl = min != null && max != null ? `฿${(min/1e6).toFixed(0)}M–${(max/1e6).toFixed(0)}M`
        : min != null ? `฿${(min/1e6).toFixed(0)}M+`
        : `< ฿${(max!/1e6).toFixed(0)}M`;
      chips.push({ label: lbl, clear: () => setFilters({ ...filters, minPrice: undefined, maxPrice: undefined }) });
    }
    if (filters.nearTransit)
      chips.push({ label: "🚇 ใกล้ BTS/MRT", clear: () => setFilters({ ...filters, nearTransit: undefined }) });
    if (filters.minYearBuilt != null)
      chips.push({ label: `🏗️ ${filters.minYearBuilt}+`, clear: () => setFilters({ ...filters, minYearBuilt: undefined }) });
    if (filters.hasYield)
      chips.push({ label: "📈 มี Yield", clear: () => setFilters({ ...filters, hasYield: undefined }) });
    if (filters.sortBy)
      chips.push({ label: `↕ ${SORT_OPTIONS.find(s => s.value === filters.sortBy)?.label ?? ""}`, clear: () => setFilters({ ...filters, sortBy: undefined }) });
    return chips;
  }, [filters]);

  const toggleFavorite = (id: string) => {
    setFavoriteItems((prev) => {
      let updated: Property[];
      if (prev.some((p) => p.id === id)) {
        updated = prev.filter((p) => p.id !== id);
      } else {
        const prop = results.find((p) => p.id === id) ?? ragResults?.find((p) => p.id === id);
        updated = prop ? [...prev, prop] : prev;
      }
      try { localStorage.setItem("estate_favorites", JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="font-serif text-lg font-semibold leading-tight tracking-tight">Estate AI</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Bangkok · 53,466 listings
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-[11px] text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-amber-500" />
            AI-powered property search
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsFavoritesOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
            >
              <Heart className={`h-3.5 w-3.5 ${favorites.size > 0 ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
              <span>{favorites.size > 0 ? favorites.size : "Saved"}</span>
            </button>
            <Link
              to="/admin"
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-accent transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </Link>
          </div>
        </div>
      </header>

      <HeroCarousel />

      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
        {/* Search row */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApplyAllFilters(); }}
              placeholder="ค้นหาทำเล เขต หรือชื่อโครงการ…"
              className="h-11 rounded-full border-border bg-card pl-11 pr-4 text-sm shadow-sm"
            />
          </div>
          <Button
            variant="outline"
            className="h-11 gap-2 rounded-full border-border bg-card px-4 shadow-sm shrink-0"
          >
            <BellPlus className="h-4 w-4" /> แจ้งเตือน
          </Button>
        </div>

        {/* Filter pills row */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">

            {/* Property type */}
            <Popover open={typeOpen} onOpenChange={setTypeOpen}>
              <PopoverTrigger asChild>
                <button className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-secondary/60 ${typeDraft.size > 0 ? "border-primary bg-primary/5 text-primary" : "border-border bg-background"}`}>
                  <Building className="h-3.5 w-3.5" />
                  {typeDraft.size === 0 ? "ประเภท" : typeOptions.filter(o => typeDraft.has(o.value)).map(o => o.label.split(" ")[0]).join(", ")}
                  {typeDraft.size > 0 && <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">{typeDraft.size}</span>}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent style={{ zIndex: 1000 }} align="start" className="w-[280px] p-0">
                <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">ประเภทอสังหาฯ</div>
                <div className="p-2">
                  {typeOptions.map(({ value, label, icon: Icon }) => (
                    <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60">
                      <Checkbox checked={typeDraft.has(value)} onCheckedChange={() => toggleTypeDraft(value)} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{label}</span>
                      <span className="text-xs text-muted-foreground">({typeCounts[value] ?? 0})</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-border px-4 py-2.5">
                  <Button onClick={() => setTypeOpen(false)} className="flex-1" size="sm">เลือก</Button>
                  <Button onClick={() => setTypeDraft(new Set())} variant="ghost" size="sm">ล้าง</Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Price */}
            <Popover open={priceOpen} onOpenChange={setPriceOpen}>
              <PopoverTrigger asChild>
                <button className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-secondary/60 ${(filtersDraft.minPrice != null || filtersDraft.maxPrice != null) ? "border-primary bg-primary/5 text-primary" : "border-border bg-background"}`}>
                  <DollarSign className="h-3.5 w-3.5" />
                  {priceLabel}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent style={{ zIndex: 1000 }} align="start" className="w-[300px] p-4 space-y-3">
                <div className="text-sm font-semibold">งบประมาณ (บาท)</div>
                {/* Preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPricePreset(undefined, undefined)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${!filtersDraft.minPrice && !filtersDraft.maxPrice ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary/60"}`}
                  >ทั้งหมด</button>
                  {PRICE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setPricePreset(p.min, p.max)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${activePricePreset?.label === p.label ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary/60"}`}
                    >{p.label}</button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">หรือใส่ราคากำหนดเอง</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="ราคาต่ำสุด" value={filtersDraft.minPrice ?? ""}
                    onChange={(e) => setFiltersDraft({ ...filtersDraft, minPrice: e.target.value ? Number(e.target.value) : undefined })} />
                  <Input type="number" placeholder="ราคาสูงสุด" value={filtersDraft.maxPrice ?? ""}
                    onChange={(e) => setFiltersDraft({ ...filtersDraft, maxPrice: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFiltersDraft({ ...filtersDraft, minPrice: undefined, maxPrice: undefined })}>ล้าง</Button>
              </PopoverContent>
            </Popover>

            {/* Near BTS/MRT */}
            <button
              onClick={() => setFiltersDraft({ ...filtersDraft, nearTransit: filtersDraft.nearTransit ? undefined : true })}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${filtersDraft.nearTransit ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary/60"}`}
            >
              <Train className="h-3.5 w-3.5" />
              BTS / MRT
            </button>

            {/* Year built */}
            <Popover open={yearOpen} onOpenChange={setYearOpen}>
              <PopoverTrigger asChild>
                <button className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-secondary/60 ${filtersDraft.minYearBuilt != null ? "border-primary bg-primary/5 text-primary" : "border-border bg-background"}`}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  {filtersDraft.minYearBuilt != null ? `${filtersDraft.minYearBuilt}+` : "ปีที่สร้าง"}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent style={{ zIndex: 1000 }} align="start" className="w-[220px] p-2">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ปีที่สร้าง</div>
                {YEAR_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setFiltersDraft({ ...filtersDraft, minYearBuilt: p.minYear }); setYearOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary/60 ${activeYearPreset?.label === p.label ? "font-semibold text-primary" : ""}`}
                  >
                    {activeYearPreset?.label === p.label && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span className={activeYearPreset?.label === p.label ? "" : "ml-5.5"}>{p.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Has rental yield */}
            <button
              onClick={() => setFiltersDraft({ ...filtersDraft, hasYield: filtersDraft.hasYield ? undefined : true })}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${filtersDraft.hasYield ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border bg-background hover:bg-secondary/60"}`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              มี Yield
            </button>

            {/* Sort by */}
            <Popover open={sortOpen} onOpenChange={setSortOpen}>
              <PopoverTrigger asChild>
                <button className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition hover:bg-secondary/60 ${filtersDraft.sortBy ? "border-primary bg-primary/5 text-primary" : "border-border bg-background"}`}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {filtersDraft.sortBy ? activeSortOption.label : "เรียงตาม"}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent style={{ zIndex: 1000 }} align="start" className="w-[220px] p-2">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">เรียงลำดับ</div>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => { setFiltersDraft({ ...filtersDraft, sortBy: opt.value }); setSortOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-secondary/60 ${activeSortOption.label === opt.label ? "font-semibold text-primary" : ""}`}
                  >
                    <span className="text-base leading-none">{opt.icon}</span>
                    {opt.label}
                    {activeSortOption.label === opt.label && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px bg-border mx-1" />

            {/* Apply */}
            <button
              onClick={handleApplyAllFilters}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-semibold shadow-sm transition-all duration-200 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 ${isFiltersDirty ? "ring-2 ring-primary/30" : ""}`}
            >
              ค้นหา
              {isFiltersDirty && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
              )}
            </button>

            {/* Clear all */}
            {hasActiveFilters && (
              <button
                onClick={() => { setFilters({}); setFiltersDraft({}); setTypeDraft(new Set()); setLocationInput(""); setAnchorPoint(null); }}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition"
              >
                <X className="h-3 w-3" /> ล้างทั้งหมด
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6 order-2 lg:order-1">
            <div
              id="map-container"
              className="overflow-hidden rounded-2xl border border-border bg-card"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Live Map</span>
                  <span className="text-xs text-muted-foreground">· {total} matches</span>
                </div>
                <div className="flex items-center gap-2">
                  {filters.area && (
                    <span className="text-xs font-medium text-destructive">
                      Highlighting {filters.area}
                    </span>
                  )}
                  {anchorPoint ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-xs text-sky-500 font-medium">
                      <Navigation className="h-3 w-3" />
                      {anchorPoint.lat.toFixed(4)}, {anchorPoint.lng.toFixed(4)}
                      {anchorPoint.maxDistanceM && ` ≤ ${anchorPoint.maxDistanceM >= 1000 ? (anchorPoint.maxDistanceM / 1000).toFixed(1) + "km" : anchorPoint.maxDistanceM + "m"}`}
                      <button onClick={() => setAnchorPoint(null)} className="ml-0.5 hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAnchorPanelOpen((v) => !v)}
                      className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-sky-400 transition-colors"
                    >
                      <Navigation className="h-3 w-3" /> จุดอ้างอิง
                    </button>
                  )}
                </div>
              </div>

              {/* Anchor point input panel */}
              {anchorPanelOpen && !anchorPoint && (
                <div className="border-b border-border bg-secondary/20 px-4 py-3 flex flex-wrap items-end gap-2 text-xs">
                  <div className="space-y-0.5">
                    <label className="text-muted-foreground uppercase tracking-wider text-[10px]">Latitude</label>
                    <input
                      value={anchorInput.lat}
                      onChange={(e) => setAnchorInput((p) => ({ ...p, lat: e.target.value }))}
                      placeholder="13.7563"
                      className="w-28 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-muted-foreground uppercase tracking-wider text-[10px]">Longitude</label>
                    <input
                      value={anchorInput.lng}
                      onChange={(e) => setAnchorInput((p) => ({ ...p, lng: e.target.value }))}
                      placeholder="100.5018"
                      className="w-28 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-muted-foreground uppercase tracking-wider text-[10px]">รัศมีสูงสุด (m)</label>
                    <input
                      value={anchorInput.dist}
                      onChange={(e) => setAnchorInput((p) => ({ ...p, dist: e.target.value }))}
                      placeholder="ว่าง = ไม่จำกัด"
                      className="w-32 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const lat = parseFloat(anchorInput.lat);
                      const lng = parseFloat(anchorInput.lng);
                      const dist = anchorInput.dist ? parseInt(anchorInput.dist) : undefined;
                      if (!isNaN(lat) && !isNaN(lng) && lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106) {
                        setAnchorPoint({ lat, lng, maxDistanceM: dist });
                        setAnchorPanelOpen(false);
                      }
                    }}
                    className="rounded bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                  >
                    ตั้งจุด
                  </button>
                  <button
                    onClick={() => setAnchorPanelOpen(false)}
                    className="text-muted-foreground hover:text-foreground px-1 py-1.5"
                  >
                    ยกเลิก
                  </button>
                  <p className="w-full text-[10px] text-muted-foreground mt-0.5">
                    💡 หรือพูดในแชท เช่น "หาคอนโดใกล้ (13.7383, 100.5602) ไม่เกิน 1km"
                  </p>
                </div>
              )}
              <div className="h-[340px] w-full">
                <Suspense
                  fallback={
                    <div className="grid h-full place-items-center text-sm text-muted-foreground">
                      Loading map…
                    </div>
                  }
                >
                  <PropertyMap
                    properties={mapPins}
                    focusedId={focusedId}
                    highlightArea={filters.area ?? null}
                    onSelect={handleSelectProperty}
                  />
                </Suspense>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">ตัวกรองที่ใช้</span>
                {activeFilterChips.map((c) => (
                  <button
                    key={c.label}
                    onClick={c.clear}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/8 border border-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/15 transition"
                  >
                    {c.label} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-serif text-xl font-semibold">
                  {ragResults !== null && !hasActiveFilters
                    ? `AI แนะนำ (${ragResults.length} รายการ)`
                    : hasActiveFilters ? "Results" : "Search properties"}
                </h2>
                {hasActiveFilters && (
                  <span className="text-xs text-muted-foreground">
                    {isLoading
                      ? "Loading…"
                      : `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, total)} of ${total.toLocaleString()}`}
                  </span>
                )}
              </div>
              {ragResults !== null && !hasActiveFilters ? (
                <div>
                  <div className="mb-3 flex items-center gap-2 text-xs text-amber-600">
                    <Sparkles className="h-3.5 w-3.5" />
                    แนะนำโดย RAG bot · {ragResults.length} รายการที่ตรงกับคำถามของคุณ
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {ragResults.map((p) => (
                      <PropertyCard
                        key={p.id}
                        property={p}
                        isFavorite={favorites.has(p.id)}
                        onToggleFavorite={toggleFavorite}
                        onFocus={handleSelectProperty}
                        onDetail={setDetailProperty}
                        highlighted={focusedId === p.id}
                      />
                    ))}
                  </div>
                </div>
              ) : !hasActiveFilters ? (
                <div className="rounded-2xl border border-dashed border-border bg-gradient-to-br from-card to-secondary/40 p-12 text-center">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/5 border border-border">
                    <Sparkles className="h-7 w-7 text-amber-500" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">
                    Find your perfect Bangkok home
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use the search bar, filters, or chat with the AI to explore 53,466 listings
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["Sukhumvit condos", "Houses near BTS", "Budget under 3M"].map((hint) => (
                      <span key={hint} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                        {hint}
                      </span>
                    ))}
                  </div>
                </div>
              ) : results.length === 0 && !isLoading ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No properties match. Try adjusting your filters.
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
                        onDetail={setDetailProperty}
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
              onFiltersChange={(f) => {
                // If chat sends lat/lng, sync to anchorPoint state
                if (f.lat && f.lng) {
                  setAnchorPoint({ lat: f.lat, lng: f.lng, maxDistanceM: f.maxDistanceM });
                  const { lat: _l, lng: _g, maxDistanceM: _d, ...rest } = f;
                  setFilters(rest);
                } else {
                  setFilters(f);
                }
              }}
              sessionId={sessionId}
              onSessionChange={setSessionId}
              onNewChat={startNewChat}
              onRagResults={setRagResults}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card/50 py-8">
        <div className="mx-auto max-w-[1600px] px-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <span className="font-serif text-sm font-semibold">Estate AI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            53,466 Bangkok listings · AI-powered property search · Data from Baania
          </p>
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

      {/* Property Detail Modal — opened from Results grid */}
      <PropertyModal
        isOpen={!!detailProperty}
        onClose={() => setDetailProperty(null)}
        property={detailProperty ? {
          id: detailProperty.id,
          title: detailProperty.name,
          description: detailProperty.description,
          image: detailProperty.image,
          price: detailProperty.price,
          price_per_sqm: detailProperty.price_per_sqm,
          tags: detailProperty.tags,
          propertyType: detailProperty.propertyType,
          area_name: detailProperty.area_name,
          developer: detailProperty.developer,
          year_built: detailProperty.year_built,
          nbr_floors: detailProperty.nbr_floors,
          rental_yield: detailProperty.rental_yield,
          near_transit: detailProperty.near_transit,
          district: detailProperty.district,
          province: detailProperty.province,
          url: detailProperty.url,
        } : null}
        onViewMap={() => {
          if (detailProperty) {
            setDetailProperty(null);
            handleSelectProperty(detailProperty.id);
            document.getElementById('map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />
    </div>
  );
}
