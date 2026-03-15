import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
};

export default function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [current, setCurrent] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCurrent((c) => Math.min(photos.length - 1, c + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photos.length, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      {photos.length > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
          {current + 1} / {photos.length}
        </span>
      )}

      {/* Prev */}
      {current > 0 && (
        <button
          className="absolute left-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); setCurrent((c) => c - 1); }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Image */}
      <img
        src={photos[current]}
        alt={`Photo ${current + 1}`}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {current < photos.length - 1 && (
        <button
          className="absolute right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); setCurrent((c) => c + 1); }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>,
    document.body
  );
}
