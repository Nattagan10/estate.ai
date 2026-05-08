import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type Property } from "@/data/properties";
import { formatPrice } from "@/lib/filterProperties";

const makeIcon = (active: boolean) =>
  L.divIcon({
    className: "estate-marker",
    html: `<div style="
      transform: translate(-50%, -100%);
      background: ${active ? "oklch(0.78 0.13 75)" : "oklch(0.22 0.04 255)"};
      color: ${active ? "oklch(0.18 0.03 250)" : "white"};
      padding: 6px 10px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 6px 16px -4px rgba(0,0,0,0.35);
      border: 2px solid white;
    ">📍</div>`,
    iconSize: [0, 0],
  });

function FlyTo({ id, properties }: { id: string | null; properties: Property[] }) {
  const map = useMap();
  useEffect(() => {
    if (!id) return;
    const p = properties.find(x => x.id === id);
    if (p) map.flyTo([p.lat, p.lng], 15, { duration: 0.8 });
  }, [id, properties, map]);
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
  onSelect,
}: {
  properties: Property[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}) {
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
      <FitBounds properties={properties} />
      <FlyTo id={focusedId} properties={properties} />
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