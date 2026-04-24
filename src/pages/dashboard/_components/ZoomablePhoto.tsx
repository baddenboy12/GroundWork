import { useCallback, useRef } from "react";
import { motion, useMotionValue, animate } from "motion/react";

type Props = {
  src: string;
  alt: string;
  onClose: () => void;
};

type Pt = { x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 260;
const PAN_THRESHOLD = 6;
const SPRING = { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.8 };

export default function ZoomablePhoto({ src, alt, onClose }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const pointers = useRef(new Map<number, Pt>());
  const pinchStart = useRef<null | {
    dist: number;
    midX: number;
    midY: number;
    scale: number;
    tx: number;
    ty: number;
  }>(null);
  const panLast = useRef<Pt | null>(null);
  const didGesture = useRef(false);
  const lastTap = useRef<null | { t: number; x: number; y: number }>(null);
  const pendingCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scale = useMotionValue(1);
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);

  const clampPan = useCallback(
    (cx: number, cy: number, s: number) => {
      const img = imgRef.current;
      if (!img) return { x: cx, y: cy };
      const currS = scale.get() || 1;
      const rect = img.getBoundingClientRect();
      const baseW = rect.width / currS;
      const baseH = rect.height / currS;
      const maxX = Math.max(0, (baseW * s - window.innerWidth) / 2);
      const maxY = Math.max(0, (baseH * s - window.innerHeight) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, cx)),
        y: Math.max(-maxY, Math.min(maxY, cy)),
      };
    },
    [scale]
  );

  const cancelPendingClose = () => {
    if (pendingCloseTimer.current) {
      clearTimeout(pendingCloseTimer.current);
      pendingCloseTimer.current = null;
    }
  };

  const snapAfterRelease = useCallback(() => {
    const s = scale.get();
    if (s <= 1.01) {
      animate(scale, 1, SPRING);
      animate(tx, 0, SPRING);
      animate(ty, 0, SPRING);
    } else {
      const c = clampPan(tx.get(), ty.get(), s);
      animate(tx, c.x, SPRING);
      animate(ty, c.y, SPRING);
    }
  }, [scale, tx, ty, clampPan]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const w = wrapperRef.current;
    if (!w) return;
    try {
      w.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers throw on duplicate capture */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelPendingClose();

    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      pinchStart.current = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        midX: (p1.x + p2.x) / 2,
        midY: (p1.y + p2.y) / 2,
        scale: scale.get(),
        tx: tx.get(),
        ty: ty.get(),
      };
      didGesture.current = true;
      panLast.current = null;
    } else if (pointers.current.size === 1) {
      panLast.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const pts = Array.from(pointers.current.values()).slice(0, 2);
      const [p1, p2] = pts;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const s0 = pinchStart.current;
      const raw = s0.scale * (dist / s0.dist);
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
      // Keep the pinch-start midpoint anchored to the same point on the image
      const vpcx = window.innerWidth / 2;
      const vpcy = window.innerHeight / 2;
      const pivotX = (s0.midX - vpcx - s0.tx) / s0.scale;
      const pivotY = (s0.midY - vpcy - s0.ty) / s0.scale;
      const rawTx = midX - vpcx - pivotX * newScale;
      const rawTy = midY - vpcy - pivotY * newScale;
      const c = clampPan(rawTx, rawTy, newScale);
      scale.set(newScale);
      tx.set(c.x);
      ty.set(c.y);
    } else if (pointers.current.size === 1 && scale.get() > 1 && panLast.current) {
      const dx = e.clientX - panLast.current.x;
      const dy = e.clientY - panLast.current.y;
      panLast.current = { x: e.clientX, y: e.clientY };
      if (Math.abs(dx) + Math.abs(dy) > PAN_THRESHOLD) didGesture.current = true;
      const c = clampPan(tx.get() + dx, ty.get() + dy, scale.get());
      tx.set(c.x);
      ty.set(c.y);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const w = wrapperRef.current;
    if (w) {
      try {
        w.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panLast.current = null;
      snapAfterRelease();
    } else if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values());
      panLast.current = { x: p.x, y: p.y };
    }
  };

  const toggleDoubleTapZoom = (cx: number, cy: number) => {
    if (scale.get() > 1.01) {
      animate(scale, 1, SPRING);
      animate(tx, 0, SPRING);
      animate(ty, 0, SPRING);
    } else {
      const vpcx = window.innerWidth / 2;
      const vpcy = window.innerHeight / 2;
      const pivotX = cx - vpcx;
      const pivotY = cy - vpcy;
      const newScale = DOUBLE_TAP_SCALE;
      const rawTx = -pivotX * (newScale - 1);
      const rawTy = -pivotY * (newScale - 1);
      const c = clampPan(rawTx, rawTy, newScale);
      animate(scale, newScale, SPRING);
      animate(tx, c.x, SPRING);
      animate(ty, c.y, SPRING);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (didGesture.current) {
      didGesture.current = false;
      return;
    }
    const now = Date.now();
    const last = lastTap.current;
    if (
      last &&
      now - last.t < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40
    ) {
      lastTap.current = null;
      cancelPendingClose();
      toggleDoubleTapZoom(e.clientX, e.clientY);
      return;
    }
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    pendingCloseTimer.current = setTimeout(() => {
      pendingCloseTimer.current = null;
      if (lastTap.current && lastTap.current.t === now) {
        lastTap.current = null;
        onClose();
      }
    }, DOUBLE_TAP_MS);
  };

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: 40 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.4, opacity: 0, y: 60 }}
      transition={{ type: "spring", stiffness: 350, damping: 22, mass: 0.7 }}
      className="flex items-center justify-center"
    >
      <div
        ref={wrapperRef}
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        <motion.img
          ref={imgRef}
          src={src}
          alt={alt}
          className="max-w-[92vw] max-h-[85vh] rounded-2xl shadow-2xl object-contain cursor-pointer select-none"
          draggable={false}
          style={{ scale, x: tx, y: ty, touchAction: "none", userSelect: "none" }}
        />
      </div>
    </motion.div>
  );
}
