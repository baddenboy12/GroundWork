import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
};

export default function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [current, setCurrent] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCurrent((c) => Math.min(photos.length - 1, c + 1));
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [photos.length, onClose]);

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(photos.length - 1, c + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Rendered inline inside DialogContent — position:fixed escapes overflow and
  // stays within Radix's focus trap so buttons remain interactive.
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center select-none"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 active:bg-white/30 transition-colors"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Counter */}
      {photos.length > 1 && (
        <span className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full pointer-events-none">
          {current + 1} / {photos.length}
        </span>
      )}

      {/* Prev */}
      {current > 0 && (
        <button
          className="absolute left-3 sm:left-5 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/25 active:scale-95 transition-all shadow-lg"
          onClick={(e) => { e.stopPropagation(); prev(); }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Image */}
      <img
        src={photos[current]}
        alt={`Photo ${current + 1}`}
        className="max-w-[92vw] max-h-[86vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Next */}
      {current < photos.length - 1 && (
        <button
          className="absolute right-3 sm:right-5 w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/25 active:scale-95 transition-all shadow-lg"
          onClick={(e) => { e.stopPropagation(); next(); }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
          {photos.map((_, i) => (
            <button
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-white scale-125" : "bg-white/40"}`}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
