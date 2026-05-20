import { useEffect, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  InfoWindow,
  Pin,
} from "@vis.gl/react-google-maps";
import type { Property } from "@/data/properties";
import { formatPrice } from "@/lib/filterProperties";

const AREA_CENTERS: Record<string, { lat: number; lng: number; radius: number }> = {
  Asok: { lat: 13.7373, lng: 100.5601, radius: 900 },
  Thonglor: { lat: 13.7307, lng: 100.5806, radius: 900 },
  "Phrom Phong": { lat: 13.7308, lng: 100.5697, radius: 900 },
  Ekkamai: { lat: 13.7196, lng: 100.5853, radius: 900 },
  "Bang Na": { lat: 13.668, lng: 100.6045, radius: 1300 },
  Silom: { lat: 13.7253, lng: 100.534, radius: 900 },
  Sathorn: { lat: 13.7236, lng: 100.5288, radius: 900 },
  Siam: { lat: 13.7466, lng: 100.5347, radius: 800 },
  Chidlom: { lat: 13.744, lng: 100.5435, radius: 700 },
  Ari: { lat: 13.7793, lng: 100.545, radius: 800 },
  Kaset: { lat: 13.848, lng: 100.571, radius: 1200 },
  "Lat Phrao": { lat: 13.816, lng: 100.561, radius: 1300 },
  Ratchada: { lat: 13.77, lng: 100.574, radius: 1100 },
  "Huai Khwang": { lat: 13.777, lng: 100.574, radius: 1100 },
  "Bang Sue": { lat: 13.803, lng: 100.538, radius: 1200 },
  Chatuchak: { lat: 13.799, lng: 100.553, radius: 1200 },
  Ramkhamhaeng: { lat: 13.756, lng: 100.61, radius: 1300 },
  "Bang Kapi": { lat: 13.766, lng: 100.647, radius: 1300 },
  Thonburi: { lat: 13.727, lng: 100.488, radius: 1300 },
  "Bang Rak": { lat: 13.728, lng: 100.52, radius: 900 },
  Pinklao: { lat: 13.777, lng: 100.479, radius: 1100 },
  "On Nut": { lat: 13.705, lng: 100.601, radius: 900 },
  "Udom Suk": { lat: 13.694, lng: 100.609, radius: 900 },
  Rangsit: { lat: 13.987, lng: 100.616, radius: 1800 },
};

function MapController({
  properties,
  focusedId,
  highlightArea,
}: {
  properties: Property[];
  focusedId: string | null;
  highlightArea?: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (focusedId) {
      const p = properties.find((x) => x.id === focusedId);
      if (p) {
        map.panTo({ lat: p.lat, lng: p.lng });
        map.setZoom(15);
        return;
      }
    }
    if (highlightArea && AREA_CENTERS[highlightArea]) {
      const c = AREA_CENTERS[highlightArea];
      map.panTo({ lat: c.lat, lng: c.lng });
      map.setZoom(14);
      return;
    }
    if (properties.length > 0 && typeof window !== "undefined" && (window as any).google) {
      const bounds = new (window as any).google.maps.LatLngBounds();
      properties.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds);
    }
  }, [map, properties, focusedId, highlightArea]);

  return null;
}

function ZoneHighlight({ area }: { area?: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof window === "undefined" || !(window as any).google) return;
    if (!area || !AREA_CENTERS[area]) return;

    const c = AREA_CENTERS[area];
    const circle = new (window as any).google.maps.Circle({
      map,
      center: { lat: c.lat, lng: c.lng },
      radius: c.radius,
      fillColor: "#f59e0b",
      fillOpacity: 0.18,
      strokeColor: "#f59e0b",
      strokeOpacity: 0.9,
      strokeWeight: 2.5,
    });

    // Animated pulse effect — expand then contract once
    let growing = true;
    let scale = 1;
    const interval = setInterval(() => {
      scale += growing ? 0.008 : -0.008;
      if (scale >= 1.12) growing = false;
      if (scale <= 1) { growing = true; scale = 1; }
      circle.setRadius(c.radius * scale);
    }, 30);

    return () => {
      clearInterval(interval);
      circle.setMap(null);
    };
  }, [map, area]);

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
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const activeId = focusedId || selectedPropId;
  const activeProp = properties.find((p) => p.id === activeId);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={{ lat: 13.7466, lng: 100.5347 }}
        defaultZoom={11}
        gestureHandling="greedy"
        disableDefaultUI={true}
        mapId="DEMO_MAP_ID"
        style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
      >
        <MapController
          properties={properties}
          focusedId={focusedId}
          highlightArea={highlightArea}
        />
        <ZoneHighlight area={highlightArea} />

        {properties.map((p) => {
          const isActive = p.id === activeId;
          return (
            <AdvancedMarker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              onClick={() => {
                onSelect(p.id);
                setSelectedPropId(p.id);
              }}
              zIndex={isActive ? 100 : 1}
            >
              <Pin
                background={isActive ? "#ef4444" : "#9ca3af"}
                borderColor={isActive ? "#b91c1c" : "#4b5563"}
                glyphColor="#fff"
              />
            </AdvancedMarker>
          );
        })}

        {activeProp && (
          <InfoWindow
            position={{ lat: activeProp.lat, lng: activeProp.lng }}
            onCloseClick={() => setSelectedPropId(null)}
          >
            <div style={{ minWidth: 180, padding: 4, fontFamily: "sans-serif" }}>
              <strong>{activeProp.name}</strong>
              <div style={{ fontSize: 12, color: "#666" }}>{activeProp.area_name}</div>
              <div style={{ marginTop: 4, fontWeight: 600 }}>{formatPrice(activeProp)}</div>
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}
