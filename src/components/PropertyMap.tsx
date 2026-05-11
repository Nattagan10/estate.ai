import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type Property } from "@/data/properties";
import { formatPrice } from "@/lib/filterProperties";

const makeIcon = (active: boolean) => {
  const color = active ? "#ef4444" : "#9ca3af"; // red-500 / gray-400
  // Lucide MapPin SVG path
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24"
      fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      style="filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35)); transform: translate(-50%, -100%); ${active ? "transform: translate(-50%, -100%) scale(1.25);" : ""}">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
      <circle cx="12" cy="10" r="3" fill="white" stroke="${color}"/>
    </svg>`;
  return L.divIcon({
    className: "estate-marker",
    html: svg,
    iconSize: [0, 0],
  });
};

// Approximate centers for each Bangkok zone (used to highlight the area)
const AREA_CENTERS: Record<string, { lat: number; lng: number; radius: number }> = {
  Siam: { lat: 13.7466, lng: 100.5347, radius: 700 },
  Asok: { lat: 13.7376, lng: 100.5602, radius: 700 },
  Pathumwan: { lat: 13.7398, lng: 100.5300, radius: 900 },
  Sathorn: { lat: 13.7237, lng: 100.5270, radius: 900 },
  Thonglor: { lat: 13.7320, lng: 100.5790, radius: 900 },
  Ari: { lat: 13.7795, lng: 100.5446, radius: 800 },
  "Phrom Phong": { lat: 13.7305, lng: 100.5697, radius: 700 },
  "Khlong San": { lat: 13.7271, lng: 100.5103, radius: 800 },
  "Lat Phrao": { lat: 13.8067, lng: 100.5760, radius: 1200 },
  Rangsit: { lat: 14.0317, lng: 100.6175, radius: 1500 },
};

function FlyTo({ id, properties }: { id: string | null; properties: Property[] }) {
  const map = useMap();
  useEffect(() => {
    if (!id) return;
    const p = properties.find(x => x.id === id);
    if (p) map.flyTo([p.lat, p.lng], 15, { duration: 0.8 });
  }, [id, properties, map]);
  return null;
}

function FlyToArea({ area }: { area: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!area) return;
    const c = AREA_CENTERS[area];
    if (c) map.flyTo([c.lat, c.lng], 14, { duration: 0.9 });
  }, [area, map]);
  return null;
}

function FitBounds({ properties }: { properties: Property[] }) {
  const map = useMap();
  useEffect(() => {
    if (properties.length === 0) return;
    const bounds = L.latLngBounds(properties.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [properties, map]);
  return null;
}

export function PropertyMap({
  properties,
  focusedId,
  highlightArea,
  onSelect,
}: {
  properties: Property[];
  focusedId: string | null;
  highlightArea?: string | null;
  onSelect: (id: string) => void;
}) {
  const zone = highlightArea ? AREA_CENTERS[highlightArea] : null;
  return (
    <MapContainer
      center={[13.7466, 100.5347]}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
      style={{ borderRadius: "1rem" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {!highlightArea && <FitBounds properties={properties} />}
      <FlyToArea area={highlightArea ?? null} />
      <FlyTo id={focusedId} properties={properties} />
      {zone && (
        <Circle
          center={[zone.lat, zone.lng]}
          radius={zone.radius}
          pathOptions={{ color: "#ef4444", weight: 2, fillColor: "#ef4444", fillOpacity: 0.12 }}
        />
      )}
      {properties.map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={makeIcon(p.id === focusedId)}
          eventHandlers={{ click: () => onSelect(p.id) }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <strong>{p.name}</strong>
              <div style={{ fontSize: 12, color: "#666" }}>{p.area_name}</div>
              <div style={{ marginTop: 4, fontWeight: 600 }}>{formatPrice(p)}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}