import { useState, useRef, useEffect } from "react";
import { LocateFixed, MapPin, X, Navigation } from "lucide-react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";

// Fix Leaflet's default marker icons when bundled
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Coords = { lat: number; lng: number; accuracy?: number };

type GpsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

type NominatimResult = {
  display_name: string;
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
      { headers: { "Accept-Language": "en" } }
    );
    const data: NominatimResult = await res.json();
    return data.display_name;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

/** Re-centers the map when coords change */
function MapRecenter({ coords }: { coords: Coords }) {
  const map = useMap();
  useEffect(() => {
    map.setView([coords.lat, coords.lng], 17, { animate: true });
  }, [coords, map]);
  return null;
}

/** Draggable marker — updates address on drag end */
function DraggableMarker({
  coords,
  onMove,
}: {
  coords: Coords;
  onMove: (c: Coords, address: string) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = {
    dragend: async () => {
      const marker = markerRef.current;
      if (!marker) return;
      const { lat, lng } = marker.getLatLng();
      const address = await reverseGeocode(lat, lng);
      onMove({ lat, lng }, address);
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[coords.lat, coords.lng]}
      ref={markerRef}
    />
  );
}

/** Click anywhere on the map to move the pin */
function MapClickHandler({
  onMove,
}: {
  onMove: (c: Coords, address: string) => void;
}) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);
      onMove({ lat, lng }, address);
    },
  });
  return null;
}

export type PickerCoords = { lat: number; lng: number };

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Fired whenever GPS is acquired or pin is moved. null when map is dismissed. */
  onCoordsChange?: (coords: PickerCoords | null) => void;
  /** Pre-load the map at these coordinates (e.g. when editing an existing log) */
  initialCoords?: PickerCoords | null;
  placeholder?: string;
  id?: string;
  required?: boolean;
};

/**
 * WhatsApp-style location input.
 * - Manual text entry
 * - One-tap GPS auto-fill (browser Geolocation + OpenStreetMap Nominatim)
 * - Live map preview with draggable / clickable pin to fine-tune position
 * - Fires onCoordsChange with lat/lng whenever the pin position changes
 */
export default function LocationPicker({
  value,
  onChange,
  onCoordsChange,
  initialCoords,
  placeholder = "e.g. 123 Main St, City",
  id,
  required,
}: Props) {
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [coords, setCoords] = useState<Coords | null>(
    initialCoords ? { lat: initialCoords.lat, lng: initialCoords.lng } : null
  );
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(!!initialCoords);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleGps = () => {
    if (!("geolocation" in navigator)) {
      setGps({ status: "error", message: "Geolocation is not supported by this browser." });
      return;
    }
    setGps({ status: "loading" });
    setShowMap(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        const address = await reverseGeocode(latitude, longitude);
        const newCoords = { lat: latitude, lng: longitude, accuracy: Math.round(acc) };
        setCoords(newCoords);
        setAccuracy(Math.round(acc));
        onChange(address);
        onCoordsChange?.({ lat: latitude, lng: longitude });
        setShowMap(true);
        setGps({ status: "idle" });
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Permission denied. Allow location access in your browser settings.",
          2: "Location unavailable. Please try again or enter manually.",
          3: "Request timed out. Please try again.",
        };
        setGps({ status: "error", message: messages[err.code] ?? "Could not get location." });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handlePinMove = (newCoords: Coords, address: string) => {
    setCoords(newCoords);
    if (!newCoords.accuracy) setAccuracy(null);
    onChange(address);
    onCoordsChange?.({ lat: newCoords.lat, lng: newCoords.lng });
  };

  const handleDismissMap = () => {
    setShowMap(false);
    setCoords(null);
    setAccuracy(null);
    onCoordsChange?.(null);
  };

  return (
    <div className="space-y-2">
      {/* Input row */}
      <div className="relative flex items-center">
        <MapPin className="absolute left-5 w-8 h-8 text-muted-foreground pointer-events-none shrink-0" />
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="pl-14 pr-16 h-[5rem] rounded-2xl truncate !text-[22px]"
          autoComplete="off"
        />
        {/* GPS button — large, highlighted, easy to tap */}
        <button
          type="button"
          title={gps.status === "loading" ? "Getting location…" : "Use my current location"}
          disabled={gps.status === "loading"}
          onClick={handleGps}
          className={cn(
            "absolute right-3 h-10 w-10 flex items-center justify-center rounded-lg transition-all",
            gps.status === "loading"
              ? "bg-primary/20 text-primary animate-pulse cursor-wait"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          )}
        >
          <LocateFixed className="w-5 h-5" />
        </button>
      </div>

      {/* GPS error */}
      {gps.status === "error" && (
        <p className="text-lg text-destructive flex items-start gap-2">
          <Navigation className="w-5 h-5 shrink-0 mt-0.5" />
          {gps.message}
        </p>
      )}

      {/* Map preview */}
      {showMap && coords && (
        <div className="rounded-xl overflow-hidden border border-border shadow-sm">
          {/* Map header */}
          <div className="flex items-center justify-between px-5 py-4 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-primary rounded-full p-1.5 shrink-0">
                <Navigation className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">Location confirmed</span>
              {accuracy !== null && (
                <span className="text-sm text-primary bg-primary/10 rounded-full px-3 py-1 font-medium">
                  ±{accuracy}m
                </span>
              )}
              <span className="text-base text-muted-foreground font-mono">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismissMap}
              className="w-12 h-12 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 ml-2"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* Leaflet map — taller for touch */}
          <MapContainer
            center={[coords.lat, coords.lng]}
            zoom={17}
            style={{ height: "440px" }}
            className="w-full"
            zoomControl={true}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapRecenter coords={coords} />
            <DraggableMarker coords={coords} onMove={handlePinMove} />
            <MapClickHandler onMove={handlePinMove} />
          </MapContainer>

          {/* Hint */}
          <div className="px-5 py-4 bg-muted/30 border-t border-border">
            <p className="text-base text-muted-foreground">
              Drag the pin or tap anywhere on the map to fine-tune the location.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
