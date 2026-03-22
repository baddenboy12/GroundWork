import { useRef, useState, useCallback } from "react";

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

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isDragging.current = false;
    currentIndex.current = null;
    setDragIndex(null);
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
      // Ignore right-clicks and non-primary buttons
      if (e.button !== 0) return;
      // Don't start drag from remove button
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;

      startPos.current = { x: e.clientX, y: e.clientY };
      currentIndex.current = index;

      const threshold = e.pointerType === "touch" ? 300 : 150;

      timerRef.current = setTimeout(() => {
        isDragging.current = true;
        setDragIndex(index);
        // Prevent scrolling while dragging
        if (containerRef.current) {
          containerRef.current.style.touchAction = "none";
        }
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
          return;
        }
      }

      if (!isDragging.current || currentIndex.current === null) return;

      const overIdx = getIndexAtPoint(e.clientX, e.clientY);
      if (overIdx !== null && overIdx !== currentIndex.current) {
        const from = currentIndex.current;
        const newItems = arrayMove(items, from, overIdx);
        currentIndex.current = overIdx;
        setDragIndex(overIdx);
        onChange(newItems);
      }
    },
    [items, onChange, getIndexAtPoint]
  );

  const handlePointerUp = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.touchAction = "";
    }
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
