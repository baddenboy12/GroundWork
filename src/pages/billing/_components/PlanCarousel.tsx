import { type ReactNode, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils.ts";

const SLOT_POSITIONS = [
  { x: 0, z: 0, scale: 1, opacity: 1, zIndex: 3 },       // front
  { x: 215, z: -200, scale: 0.85, opacity: 0.6, zIndex: 1 }, // right
  { x: -215, z: -200, scale: 0.85, opacity: 0.6, zIndex: 1 }, // left
] as const;

type Props = {
  items: ReactNode[];
  frontIndex: number;
  onFrontIndexChange: (index: number) => void;
  /** Visible height of the 3D card stage in pixels. Defaults to 480 to preserve
   *  the original billing-page layout. The landing page passes a smaller value
   *  so the whole page can fit on a typical laptop viewport without scrolling. */
  height?: number;
};

export default function PlanCarousel({ items, frontIndex, onFrontIndexChange, height = 480 }: Props) {
  const count = items.length;
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const swiped = useRef(false);

  const getSlot = (itemIndex: number) => {
    return ((itemIndex - frontIndex) % count + count) % count;
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swiped.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || swiped.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.time;

    // Only count horizontal swipes (not vertical scrolls)
    if (Math.abs(dy) > Math.abs(dx) * 0.8) {
      touchStart.current = null;
      return;
    }

    // Velocity-based: fast flick or sufficient distance
    const velocity = Math.abs(dx) / Math.max(dt, 1);
    const threshold = velocity > 0.3 ? 20 : 40;

    if (Math.abs(dx) > threshold) {
      swiped.current = true;
      if (dx < 0) {
        onFrontIndexChange((frontIndex + 1) % count);
      } else {
        onFrontIndexChange((frontIndex - 1 + count) % count);
      }
    }
    touchStart.current = null;
  }, [frontIndex, count, onFrontIndexChange]);

  // Also support mouse drag for desktop
  const mouseStart = useRef<{ x: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't hijack clicks on buttons
    if ((e.target as HTMLElement).closest("button, a, [role=button]")) return;
    mouseStart.current = { x: e.clientX };
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!mouseStart.current) return;
    const dx = e.clientX - mouseStart.current.x;
    if (Math.abs(dx) > 40) {
      if (dx < 0) {
        onFrontIndexChange((frontIndex + 1) % count);
      } else {
        onFrontIndexChange((frontIndex - 1 + count) % count);
      }
    }
    mouseStart.current = null;
  }, [frontIndex, count, onFrontIndexChange]);

  return (
    <div className="w-full">
      <div
        style={{ perspective: 1000, height }}
        className="relative mx-auto max-w-3xl overflow-visible"
      >
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          {items.map((item, i) => {
            const slot = getSlot(i);
            const pos = SLOT_POSITIONS[slot];

            return (
              <motion.div
                key={i}
                animate={{
                  x: pos.x,
                  scale: pos.scale,
                  opacity: pos.opacity,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 28,
                  mass: 0.8,
                }}
                style={{
                  position: "absolute",
                  zIndex: pos.zIndex,
                  transform: `translateZ(${pos.z}px)`,
                  width: 340,
                }}
              >
                {item}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-3 mt-4">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onFrontIndexChange(i)}
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-300",
              i === frontIndex
                ? "bg-primary scale-125"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`Go to plan ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
