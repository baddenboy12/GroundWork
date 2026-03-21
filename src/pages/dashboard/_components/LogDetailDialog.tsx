import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
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
import { Trash2, Pencil, Clock, User, MapPin, ImageIcon, X, WifiOff } from "lucide-react";
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
  // "entering" | "open" | "exiting" | "closed"
  const [phase, setPhase] = useState<"entering" | "open" | "exiting" | "closed">("closed");

  const photos = log.photoUrls ?? [];

  // Drive phase transitions based on `open` prop
  useEffect(() => {
    if (open && (phase === "closed" || phase === "exiting")) {
      setPhase("entering");
      // After entrance animation completes, mark as fully open
      const t = setTimeout(() => setPhase("open"), 400);
      return () => clearTimeout(t);
    }
    if (!open && (phase === "entering" || phase === "open")) {
      setPhase("exiting");
      // After exit animation completes, unmount
      const t = setTimeout(() => setPhase("closed"), 450);
      return () => clearTimeout(t);
    }
  }, [open, phase]);

  // Close on Escape (only when lightbox is not open)
  useEffect(() => {
    if (phase === "closed") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightboxIndex === null) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, lightboxIndex, onClose]);

  // Lock body scroll while visible
  useEffect(() => {
    if (phase !== "closed") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [phase]);

  const handleDelete = async () => {
    try {
      await removeLog({ logId: log._id });
      toast.success("Log entry deleted");
      onClose();
    } catch {
      toast.error("Failed to delete log entry");
    }
  };

  if (phase === "closed") return null;

  const isClosing = phase === "exiting";
  const isOpening = phase === "entering";

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
          100% { opacity: 0; transform: scale(0.75) translateY(100px); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          animation: isClosing
            ? "log-backdrop-out 0.4s ease forwards"
            : "log-backdrop-in 0.3s ease forwards",
          pointerEvents: isClosing ? "none" : "auto",
        }}
      >
        {/* Modal panel */}
        <div
          className="relative bg-background rounded-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: isClosing
              ? "log-panel-out 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards"
              : "log-panel-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          {/* Close button */}
          <button
            className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Photo strip */}
          {photos.length > 0 && (
            <div
              className={cn(
                "grid gap-1 rounded-t-xl overflow-hidden",
                photos.length === 1 && "grid-cols-1",
                photos.length === 2 && "grid-cols-2",
                photos.length >= 3 && "grid-cols-3"
              )}
            >
              {photos.slice(0, 6).map((url, i) => {
                const isLast = i === 5 && photos.length > 6;
                return (
                  <button
                    key={url}
                    type="button"
                    className="relative overflow-hidden bg-muted hover:opacity-90 transition-opacity aspect-[4/3]"
                    onClick={() => setLightboxIndex(i)}
                  >
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {isLast && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-xl font-bold">+{photos.length - 6}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-8 w-8 text-muted-foreground hover:text-foreground",
                          !isOnline && "opacity-40 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (!isOnline) {
                            toast.error("You're offline — editing requires a connection");
                            return;
                          }
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isOnline && (
                    <TooltipContent side="bottom">
                      <p>Editing requires an internet connection</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-8 w-8 text-muted-foreground hover:text-destructive",
                            !isOnline && "opacity-40 cursor-not-allowed"
                          )}
                          onClick={() => {
                            if (!isOnline) {
                              toast.error("You're offline — deletion requires a connection");
                              return;
                            }
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!isOnline && (
                      <TooltipContent side="bottom">
                        <p>Deletion requires an internet connection</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
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
