import { useRef, useState, useCallback, useEffect } from "react";

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function useDragReorder<T>(items: T[], onChange: (items: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const currentIndex = useRef<number | null>(null);
  const pendingPointerId = useRef<number | null>(null);

  // Block ALL touch scrolling on the container while a long-press timer is pending or dragging
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: TouchEvent) => {
      // If we're actively dragging OR waiting for long-press threshold, block scroll
      if (isDragging.current || timerRef.current) {
        e.preventDefault();
      }
    };

    // Must be non-passive to allow preventDefault
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
    pendingPointerId.current = null;
    setDragIndex(null);
    // Re-enable touch-action
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

  const handlePointerDown = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;

      startPos.current = { x: e.clientX, y: e.clientY };
      currentIndex.current = index;
      pendingPointerId.current = e.pointerId;

      // Immediately set touch-action none to prevent scroll from starting
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
          // Re-enable scrolling since user is scrolling, not dragging
          if (containerRef.current) {
            containerRef.current.style.touchAction = "";
          }
          return;
        }
      }

      if (!isDragging.current || currentIndex.current === null) return;

      const overIdx = getIndexAtPoint(e.clientX, e.clientY);

      if (overIdx !== null && overIdx !== currentIndex.current) {
        // Swap with another photo
        const from = currentIndex.current;
        const newItems = arrayMove(items, from, overIdx);
        currentIndex.current = overIdx;
        setDragIndex(overIdx);
        onChange(newItems);
      } else if (overIdx === null && containerRef.current) {
        // Pointer is in empty grid space — move to end of list
        const lastIndex = items.length - 1;
        if (currentIndex.current !== lastIndex) {
          const from = currentIndex.current;
          const newItems = arrayMove(items, from, lastIndex);
          currentIndex.current = lastIndex;
          setDragIndex(lastIndex);
          onChange(newItems);
        }
      }
    },
    [items, onChange, getIndexAtPoint]
  );

  const handlePointerUp = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    dragIndex,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
