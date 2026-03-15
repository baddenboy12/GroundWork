import { useState, useRef } from "react";
import { LocateFixed, MapPin, X, Navigation } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";

type GpsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; address: string; accuracy: number }
  | { status: "error"; message: string };

type NominatimResult = {
  display_name: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
};

/**
 * WhatsApp-style location input.
 * Supports manual text entry AND one-tap GPS auto-fill via the browser
 * Geolocation API + OpenStreetMap Nominatim reverse-geocoding (free, no key).
 */
export default function LocationPicker({
  value,
  onChange,
  placeholder = "e.g. 123 Main St, City",
  id,
  required,
}: Props) {
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [showSuggestion, setShowSuggestion] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleGps = () => {
    if (!("geolocation" in navigator)) {
      setGps({ status: "error", message: "Geolocation is not supported by this browser." });
      return;
    }
    setGps({ status: "loading" });
    setShowSuggestion(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`,
            { headers: { "Accept-Language": "en" } }
          );
          const data: NominatimResult = await res.json();
          setGps({ status: "ready", address: data.display_name, accuracy: Math.round(accuracy) });
          setShowSuggestion(true);
        } catch {
          // If reverse geocode fails fall back to raw coordinates
          const fallback = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          setGps({ status: "ready", address: fallback, accuracy: Math.round(accuracy) });
          setShowSuggestion(true);
        }
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied. Please allow location access in your browser settings.",
          2: "Location unavailable. Please try again or enter manually.",
          3: "Location request timed out. Please try again.",
        };
        setGps({ status: "error", message: messages[err.code] ?? "Could not get location." });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handleUseLocation = () => {
    if (gps.status !== "ready") return;
    onChange(gps.address);
    setShowSuggestion(false);
    inputRef.current?.focus();
  };

  const handleDismiss = () => {
    setShowSuggestion(false);
    setGps({ status: "idle" });
  };

  return (
    <div className="space-y-2">
      {/* Input row */}
      <div className="relative flex items-center gap-2">
        {/* MapPin prefix */}
        <MapPin className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            // User is typing manually – dismiss GPS suggestion
            if (showSuggestion) setShowSuggestion(false);
          }}
          placeholder={placeholder}
          required={required}
          className="pl-9 pr-10"
          autoComplete="off"
        />
        {/* GPS trigger button */}
        <button
          type="button"
          title={
            gps.status === "loading"
              ? "Getting location…"
              : "Use my current location"
          }
          disabled={gps.status === "loading"}
          onClick={handleGps}
          className={cn(
            "absolute right-2 p-1.5 rounded-md transition-colors",
            gps.status === "loading"
              ? "text-primary animate-pulse cursor-wait"
              : "text-muted-foreground hover:text-primary hover:bg-accent"
          )}
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      {/* GPS error */}
      {gps.status === "error" && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <Navigation className="w-3 h-3 shrink-0 mt-0.5" />
          {gps.message}
        </p>
      )}

      {/* Location suggestion card */}
      {showSuggestion && gps.status === "ready" && (
        <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className="mt-0.5 bg-primary rounded-full p-1 shrink-0">
                <Navigation className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs font-semibold text-foreground">Current location</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {gps.address}
                </p>
                <p className="text-[10px] text-primary font-medium">
                  Accurate to ±{gps.accuracy}m
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseLocation}
            className="w-full text-xs font-medium text-primary border border-primary/30 rounded-md py-1.5 hover:bg-primary/10 transition-colors"
          >
            Use this location
          </button>
        </div>
      )}
    </div>
  );
}
