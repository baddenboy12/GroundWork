import { type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils.ts";

const SLOT_POSITIONS = [
  { x: 0, z: 0, scale: 1, opacity: 1, zIndex: 3 },       // front
  { x: 190, z: -200, scale: 0.85, opacity: 0.6, zIndex: 1 }, // right
  { x: -190, z: -200, scale: 0.85, opacity: 0.6, zIndex: 1 }, // left
] as const;

type Props = {
  items: ReactNode[];
  frontIndex: number;
  onFrontIndexChange: (index: number) => void;
};

export default function PlanCarousel({ items, frontIndex, onFrontIndexChange }: Props) {
  const count = items.length;

  const getSlot = (itemIndex: number) => {
    return ((itemIndex - frontIndex) % count + count) % count;
  };

  return (
    <div className="w-full">
      <div
        style={{ perspective: 1000, height: 580 }}
        className="relative mx-auto max-w-3xl overflow-visible"
      >
        <motion.div
          onPanEnd={(_, info) => {
            const swipe = info.offset.x + info.velocity.x * 0.3;
            if (swipe < -50) {
              onFrontIndexChange((frontIndex + 1) % count);
            } else if (swipe > 50) {
              onFrontIndexChange((frontIndex - 1 + count) % count);
            }
          }}
          className="relative w-full h-full flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
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
        </motion.div>
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
