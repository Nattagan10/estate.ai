import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type Filters } from "@/lib/filterProperties";

const PROPERTY_TYPES: Array<Filters["propertyType"] & string> = ["Any", "Condo", "Apartment", "House", "Townhouse"];
const LISTING_TYPES: Array<Filters["listingType"] & string> = ["Any", "rent", "sale"];

export function FiltersPanel({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const isRent = filters.listingType !== "sale";
  const max = isRent ? 100000 : 20000000;
  const step = isRent ? 1000 : 100000;
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div>
        <h3 className="font-serif text-base font-semibold">Refine</h3>
        <p className="text-xs text-muted-foreground">Tweak filters or just chat — both update results.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Listing</Label>
        <div className="flex gap-1.5">
          {LISTING_TYPES.map(t => (
            <button
              key={t}
              onClick={() => onChange({ ...filters, listingType: t })}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                (filters.listingType ?? "Any") === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {t === "Any" ? "All" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Property Type</Label>
        <div className="flex flex-wrap gap-1.5">
          {PROPERTY_TYPES.map(t => (
            <button
              key={t}
              onClick={() => onChange({ ...filters, propertyType: t })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                (filters.propertyType ?? "Any") === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Max Budget</Label>
          <span className="text-sm font-semibold text-primary">
            {isRent ? `฿${(filters.maxPrice ?? max).toLocaleString()}/mo` : `฿${((filters.maxPrice ?? max) / 1_000_000).toFixed(1)}M`}
          </span>
        </div>
        <Slider
          value={[filters.maxPrice ?? max]}
          min={isRent ? 5000 : 1000000}
          max={max}
          step={step}
          onValueChange={(v) => onChange({ ...filters, maxPrice: v[0] })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Min Bedrooms</Label>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => onChange({ ...filters, bedrooms: n })}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                (filters.bedrooms ?? 0) === n
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {n === 0 ? "Any" : `${n}+`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Toggle label="Near BTS / MRT" checked={!!filters.nearTransit} onChange={(v) => onChange({ ...filters, nearTransit: v })} />
        <Toggle label="Near University" checked={!!filters.nearUniversity} onChange={(v) => onChange({ ...filters, nearUniversity: v })} />
        <Toggle label="Near Shopping Mall" checked={!!filters.nearMall} onChange={(v) => onChange({ ...filters, nearMall: v })} />
      </div>

      <button
        onClick={() => onChange({ listingType: "Any", propertyType: "Any" })}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-muted"
      >
        Reset filters
      </button>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}