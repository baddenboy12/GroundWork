import { useRef, useState, useCallback, useEffect } from "react";

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function useDragReorder<T>(items: T[], onChange: (items: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Track which index just received a swapped-in item (for pulse animation)
  const [swappedIndex, setSwappedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapCooldownRef = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const currentIndex = useRef<number | null>(null);

  // Block ALL touch scrolling on the container while a long-press timer is pending or dragging
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: TouchEvent) => {
      if (isDragging.current || timerRef.current) {
        e.preventDefault();
      }
    };

    container.addEventListener("touchmove", preventScroll, { passive: false });
    return () => container.removeEventListener("touchmove", preventScroll);
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isDragging.current = false;
    currentIndex.current = null;
    swapCooldownRef.current = false;
    setDragIndex(null);
    setSwappedIndex(null);
    if (containerRef.current) {
      containerRef.current.style.touchAction = "";
    }
  }, []);

  const getIndexAtPoint = useCallback((x: number, y: number): number | null => {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      const attr = (el as HTMLElement).dataset?.reorderIndex;
      if (attr != null) return parseInt(attr, 10);
    }
    return null;
  }, []);

  const performSwap = useCallback(
    (from: number, to: number) => {
      if (swapCooldownRef.current) return;

      // Brief cooldown to let the animation play before another swap
      swapCooldownRef.current = true;
      setTimeout(() => {
        swapCooldownRef.current = false;
      }, 200);

      const newItems = arrayMove(items, from, to);
      // The dragged item moves to `to`, the displaced item lands at `from`
      setSwappedIndex(from);
      currentIndex.current = to;
      setDragIndex(to);
      onChange(newItems);

      // Clear swapped highlight after animation completes
      setTimeout(() => setSwappedIndex(null), 400);
    },
    [items, onChange]
  );

  const handlePointerDown = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;

      startPos.current = { x: e.clientX, y: e.clientY };
      currentIndex.current = index;

      if (containerRef.current) {
        containerRef.current.style.touchAction = "none";
      }

      const threshold = e.pointerType === "touch" ? 300 : 150;

      timerRef.current = setTimeout(() => {
        isDragging.current = true;
        setDragIndex(index);
        timerRef.current = null;
      }, threshold);

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Cancel long-press if moved too far before threshold
      if (!isDragging.current && timerRef.current) {
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
          if (containerRef.current) {
            containerRef.current.style.touchAction = "";
          }
          return;
        }
      }

      if (!isDragging.current || currentIndex.current === null) return;

      const overIdx = getIndexAtPoint(e.clientX, e.clientY);

      if (overIdx !== null && overIdx !== currentIndex.current) {
        performSwap(currentIndex.current, overIdx);
      } else if (overIdx === null && containerRef.current) {
        const lastIndex = items.length - 1;
        if (currentIndex.current !== lastIndex) {
          performSwap(currentIndex.current, lastIndex);
        }
      }
    },
    [items, getIndexAtPoint, performSwap]
  );

  const handlePointerUp = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    dragIndex,
    swappedIndex,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
