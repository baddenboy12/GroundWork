import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { Trash2, Pencil, Clock, User, MapPin, ImageIcon, X, WifiOff, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import PhotoLightbox from "./PhotoLightbox.tsx";
import EditLogDialog from "./EditLogDialog.tsx";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  log: LogWithAuthor;
  open: boolean;
  onClose: () => void;
};

export default function LogDetailDialog({ log, open, onClose }: Props) {
  const removeLog = useMutation(api.logs.remove);
  const isOnline = useOnlineStatus();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  const menuClosedAt = useRef(0);

  const handleMenuOpenChange = (isOpen: boolean) => {
    setMenuOpen(isOpen);
    menuOpenRef.current = isOpen;
    if (!isOpen) menuClosedAt.current = Date.now();
  };

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Close the dropdown if it's open and user clicked inside the panel
    // but not on the trigger button itself
    const target = e.target as HTMLElement;
    if (target.closest("[data-menu-trigger]")) return;
    if (menuOpenRef.current) {
      setMenuOpen(false);
      menuOpenRef.current = false;
      menuClosedAt.current = Date.now();
    }
  };
  const [closing, setClosing] = useState(false);

  const photos = log.photoUrls ?? [];

  // Open: show immediately
  useEffect(() => {
    if (open && !visible) {
      setClosing(false);
      setVisible(true);
    }
  }, [open, visible]);

  // Intercept close: animate out first, then notify parent
  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      onClose();
    }, 250);
  };

  // Close on Escape (only when lightbox is not open)
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightboxIndex === null) handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible, lightboxIndex, closing]);

  // Lock body scroll while visible
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  const handleDelete = async () => {
    try {
      await removeLog({ logId: log._id });
      toast.success("Log entry deleted");
      handleClose();
    } catch {
      toast.error("Failed to delete log entry");
    }
  };

  if (!visible) return null;

  return createPortal(
    <>
      {/* Inline keyframes — injected once */}
      <style>{`
        @keyframes log-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes log-backdrop-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes log-panel-in {
          0% { opacity: 0; transform: scale(0.8) translateY(60px); }
          70% { opacity: 1; transform: scale(1.03) translateY(-5px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes log-panel-out {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.85) translateY(80px); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={() => {
          if (menuOpen) {
            handleMenuOpenChange(false);
            return;
          }
          if (Date.now() - menuClosedAt.current < 200) return;
          handleClose();
        }}
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          animation: closing
            ? "log-backdrop-out 0.25s ease forwards"
            : "log-backdrop-in 0.3s ease forwards",
          pointerEvents: closing ? "none" : "auto",
        }}
      >
        {/* Modal panel */}
        <div
          className="relative bg-background rounded-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl"
          onClick={handlePanelClick}
          style={{
            animation: closing
              ? "log-panel-out 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards"
              : "log-panel-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          {/* Close button */}
          <button
            className="absolute top-3 right-3 z-10 w-16 h-16 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all"
            onClick={handleClose}
          >
            <X className="w-8 h-8" />
          </button>

          {/* Photo cascade stack */}
          {photos.length > 0 && (
            <PhotoCascade photos={photos} />
          )}

          <motion.div
            className="p-6 sm:p-8 space-y-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
            }}
          >
            {/* Header */}
            <motion.div
              className="flex items-start justify-between gap-3 pr-6"
              variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <div className="space-y-2">
                <span
                  className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-base font-medium border",
                    CATEGORY_COLORS[log.category as LogCategory]
                  )}
                >
                  {CATEGORY_LABELS[log.category as LogCategory]}
                </span>
                <h2 className="text-4xl font-semibold leading-snug text-foreground">{log.title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Offline indicator */}
                {!isOnline && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-1 rounded-full mr-1">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
                <div className="relative" data-menu-trigger>
                  <button
                    className="w-16 h-16 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent active:scale-90 transition-all"
                    aria-label="Log actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpenChange(!menuOpen);
                    }}
                  >
                    <MoreVertical style={{ width: 32, height: 32 }} />
                  </button>
                  <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      className="absolute right-0 top-[calc(100%+4px)] z-50 w-64 p-4 rounded-2xl bg-popover border border-border shadow-lg"
                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={cn(
                          "flex items-center gap-4 w-full py-5 px-4 text-xl rounded-xl hover:bg-accent transition-colors text-left",
                          !isOnline && "opacity-50"
                        )}
                        onClick={() => {
                          if (!isOnline) {
                            toast.error("You're offline — editing requires a connection");
                            return;
                          }
                          handleMenuOpenChange(false);
                          setEditOpen(true);
                        }}
                      >
                        <span className="w-7 flex items-center justify-center shrink-0"><Pencil className="w-7 h-7" /></span> Edit
                      </button>
                      <button
                        className={cn(
                          "flex items-center gap-3 w-full py-4 px-3 text-base rounded-xl hover:bg-accent transition-colors text-left text-destructive",
                          !isOnline && "opacity-50"
                        )}
                        onClick={() => {
                          if (!isOnline) {
                            toast.error("You're offline — deletion requires a connection");
                            return;
                          }
                          handleMenuOpenChange(false);
                          setDeleteOpen(true);
                        }}
                      >
                        <span className="w-7 flex items-center justify-center shrink-0"><Trash2 className="w-7 h-7" /></span> Delete
                      </button>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete log entry?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this log entry and all attached photos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={handleDelete}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              className="max-h-64 overflow-y-auto overscroll-contain rounded-lg pr-1"
              variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <p className="text-2xl text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {log.content}
              </p>
            </motion.div>

            {/* Meta */}
            <motion.div
              className="flex flex-col gap-y-3 pt-3 border-t border-border/50 text-base text-muted-foreground"
              variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              {/* Row 1: date + author */}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 shrink-0" />
                  {format(new Date(log.loggedAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 shrink-0" />
                  {log.authorName}
                </span>
              </div>
              {/* Row 2: location + coordinates */}
              {(log.location || (log.latitude != null && log.longitude != null)) && (
                <div className="flex items-center gap-4 flex-wrap">
                  {log.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {log.location}
                    </span>
                  )}
                  {log.latitude != null && log.longitude != null && (
                    <span className="font-mono text-sm text-muted-foreground/70 tabular-nums">
                      {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                    </span>
                  )}
                </div>
              )}
              {/* Row 3: photo count */}
              {photos.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" />
                  {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

    {/* Lightbox — separate portal layer above everything */}
    {lightboxIndex !== null && (
      <PhotoLightbox
        photos={photos}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    )}

    <EditLogDialog
      open={editOpen}
      onClose={() => setEditOpen(false)}
      log={log}
    />
    </>,
    document.body
  );
}

/* ── Tilted cascade photo stack ─────────────────────────────────────────────── */

type PhotoCascadeProps = {
  photos: string[];
};

function PhotoCascade({ photos }: PhotoCascadeProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const maxVisible = Math.min(photos.length, 4);
  const swipeThreshold = 50;

  const goNext = () => {
    if (activeIndex < photos.length - 1) {
      setDirection(1);
      setActiveIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (activeIndex > 0) {
      setDirection(-1);
      setActiveIndex((i) => i - 1);
    }
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipe = info.offset.x + info.velocity.x * 0.3;
    if (swipe < -swipeThreshold && activeIndex < photos.length - 1) {
      goNext();
    } else if (swipe > swipeThreshold && activeIndex > 0) {
      goPrev();
    }
  };

  // Tilt angles for stacked cards behind the active one
  const stackTilts = [0, -3, -6, -9];
  const stackOffsets = [0, 6, 12, 18];
  const stackScales = [1, 0.96, 0.92, 0.88];

  return (
    <div className="relative w-full flex flex-col items-center pt-4 pb-2 px-4">
      {/* Stack container */}
      <div
        className="relative w-full max-w-[90%] aspect-[4/3]"
        style={{ perspective: "800px" }}
      >
        {/* Background stack cards (static, behind) */}
        {Array.from({ length: Math.min(maxVisible - 1, photos.length - activeIndex - 1) }).map((_, i) => {
          const stackPos = i + 1;
          return (
            <div
              key={`stack-${stackPos}`}
              className="absolute inset-0 rounded-xl overflow-hidden border border-border/30 shadow-lg"
              style={{
                transform: `rotate(${stackTilts[stackPos]}deg) translateY(${stackOffsets[stackPos]}px) scale(${stackScales[stackPos]})`,
                zIndex: maxVisible - stackPos,
                opacity: 1 - stackPos * 0.15,
              }}
            >
              {photos[activeIndex + stackPos] && (
                <img
                  src={photos[activeIndex + stackPos]}
                  alt={`Photo ${activeIndex + stackPos + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>
          );
        })}

        {/* Active (front) card with swipe + animation */}
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={activeIndex}
            custom={direction}
            className="absolute inset-0 rounded-xl overflow-hidden border border-border/50 shadow-2xl cursor-pointer touch-pan-y"
            style={{ zIndex: maxVisible }}
            onClick={() => setZoomed(true)}
            drag={photos.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            variants={{
              enter: (d: number) => ({
                x: d > 0 ? 200 : -200,
                rotate: d > 0 ? 12 : -12,
                opacity: 0,
                scale: 0.9,
              }),
              center: {
                x: 0,
                rotate: 0,
                opacity: 1,
                scale: 1,
              },
              exit: (d: number) => ({
                x: d > 0 ? -200 : 200,
                rotate: d > 0 ? -15 : 15,
                opacity: 0,
                scale: 0.85,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              mass: 0.8,
            }}
          >
            <img
              src={photos[activeIndex]}
              alt={`Photo ${activeIndex + 1}`}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows + counter */}
      {photos.length > 1 && (
        <div className="flex items-center gap-8 mt-4">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={activeIndex === 0}
            className="p-5 rounded-full bg-muted/60 hover:bg-muted active:scale-90 disabled:opacity-30 transition-all"
          >
            <ChevronLeft style={{ width: 32, height: 32 }} />
          </button>
          <span className="text-2xl text-muted-foreground font-semibold min-w-[60px] text-center">
            {activeIndex + 1} / {photos.length}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={activeIndex === photos.length - 1}
            className="p-5 rounded-full bg-muted/60 hover:bg-muted active:scale-90 disabled:opacity-30 transition-all"
          >
            <ChevronRight style={{ width: 32, height: 32 }} />
          </button>
        </div>
      )}

      {/* Zoomed photo overlay — rendered via portal so it's above everything */}
      {createPortal(
        <AnimatePresence>
          {zoomed && (
            <motion.div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            >
              <motion.img
                src={photos[activeIndex]}
                alt={`Photo ${activeIndex + 1}`}
                className="max-w-[92vw] max-h-[85vh] rounded-2xl shadow-2xl object-contain cursor-pointer"
                draggable={false}
                initial={{ scale: 0.5, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.4, opacity: 0, y: 60 }}
                transition={{
                  type: "spring",
                  stiffness: 350,
                  damping: 22,
                  mass: 0.7,
                }}
                onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
