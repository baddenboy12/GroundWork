import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Plus, Settings, Trash2, ChevronRight, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { toast } from "sonner";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import CreateSiteDialog from "./CreateSiteDialog.tsx";
import EditSiteDialog from "./EditSiteDialog.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";
import { useSubscription } from "@/hooks/use-subscription.ts";

type Props = {
  selectedSiteId: Id<"sites"> | null;
  onSelectSite: (id: Id<"sites">) => void;
  onSiteDeleted?: (id: Id<"sites">) => void;
  /** Renders as a full-height panel instead of a fixed-width sidebar (for mobile) */
  fullscreen?: boolean;
};

const MIN_WIDTH = 140;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 176;
const STORAGE_KEY = "groundwork_sidebar_width";

export default function SiteSidebar({ selectedSiteId, onSelectSite, onSiteDeleted, fullscreen }: Props) {
  const sites = useQuery(api.sites.list, {});
  const removeSite = useMutation(api.sites.remove);
  const { config } = useSubscription();
  const [createOpen, setCreateOpen] = useState(false);
  const [editSite, setEditSite] = useState<Doc<"sites"> | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<Id<"sites"> | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const currentWidthRef = useRef(sidebarWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [isResizing, setIsResizing] = useState(false);

  // Keep ref in sync
  useEffect(() => { currentWidthRef.current = sidebarWidth; }, [sidebarWidth]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent scroll on touch so drag is smooth
    if ("touches" in e) e.preventDefault();
    isDragging.current = true;
    setIsResizing(true);
    startX.current = "touches" in e ? e.touches[0].clientX : e.clientX;
    startWidth.current = currentWidthRef.current;
    // Prevent text selection while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientX = "touches" in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const delta = clientX - startX.current;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleEnd = () => {
      isDragging.current = false;
      setIsResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(STORAGE_KEY, String(currentWidthRef.current));
      } catch { /* ignore */ }
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
  }, []);

  const siteCount = sites?.length ?? 0;
  const atSiteLimit = config.maxSites !== null && siteCount >= config.maxSites;

  const handleAddSite = () => {
    if (atSiteLimit) {
      setUpgradeOpen(true);
    } else {
      setCreateOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteSiteId) return;
    try {
      await removeSite({ siteId: deleteSiteId });
      toast.success("Site deleted");
      onSiteDeleted?.(deleteSiteId);
      setDeleteSiteId(null);
    } catch {
      toast.error("Failed to delete site");
    }
  };

  return (
    <aside
      className={cn(
        "border-border bg-card flex flex-col relative",
        fullscreen ? "w-full h-full border-r-0" : "shrink-0 border-r h-full"
      )}
      style={fullscreen ? undefined : { width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">Sites</span>
          {config.maxSites !== null && (
            <span className="text-xs text-muted-foreground">
              {siteCount}/{config.maxSites}
            </span>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Site naming help">
                <Info className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-72 p-4 space-y-3 text-sm">
              <p className="font-semibold text-foreground">How Sites Work</p>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Site name = grouping key</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All log entries with the same site name are grouped under one site. Changing a site&apos;s name renames it for every log entry under it instantly.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Smart features that help</p>
                <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <li className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    <span><strong className="text-foreground">Auto-create on first log</strong> — type a new site name when writing a log entry and the site is created for you automatically.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    <span><strong className="text-foreground">Autocomplete selector</strong> — the site field in the log dialog suggests your existing sites as you type, so you never accidentally create a duplicate.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    <span><strong className="text-foreground">Fuzzy-match warning</strong> — if a typed name is very close to an existing site (e.g. "Site A" vs "Site‑A"), a "Did you mean?" hint appears to prevent near-duplicates.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    <span><strong className="text-foreground">GPS & map location</strong> — each site and log entry can store GPS coordinates captured automatically or picked on a live map, so entries stay accurately tied to a location.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary shrink-0">→</span>
                    <span><strong className="text-foreground">Bulk rename via Edit Site</strong> — renaming a site updates all of its log entries at once, keeping your history consistent.</span>
                  </li>
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className={cn("h-7 w-7", atSiteLimit && "text-muted-foreground")}
          onClick={handleAddSite}
        >
          {atSiteLimit ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {/* Site list */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        {sites === undefined ? (
          <div className="px-4 space-y-2 pt-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="px-4 py-8 text-center space-y-1">
            <p className="text-xs font-medium text-foreground">No sites yet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sites are created automatically when you write your first log entry.
            </p>
          </div>
        ) : (
          sites.map((site, i) => (
            <motion.div
              key={site._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "group flex items-center gap-3 mx-2 px-3 py-3.5 rounded-xl cursor-pointer transition-colors",
                selectedSiteId === site._id
                  ? "bg-primary/15 text-foreground"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onSelectSite(site._id)}
            >
              <span className="flex-1 text-sm font-semibold truncate">{site.name}</span>
              {selectedSiteId === site._id && (
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-primary" />
              )}

              {/* Site actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="opacity-40 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-opacity">
                    <Settings className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditSite(site);
                    }}
                  >
                    <Settings className="w-3.5 h-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSiteId(site._id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))
        )}
      </div>

      {/* Upgrade prompt at bottom if at limit */}
      {atSiteLimit && (
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Site limit reached.{" "}
            <button
              className="text-primary hover:underline font-medium"
              onClick={() => setUpgradeOpen(true)}
            >
              Upgrade
            </button>{" "}
            for more.
          </p>
        </div>
      )}

      {/* Drag-to-resize handle — only shown on desktop (non-fullscreen).
          The outer div is 20px wide (good touch target) centered on the right
          border via translate-x-1/2. The visual pill stays thin inside it. */}
      {!fullscreen && (
        <div
          className={cn(
            "absolute top-0 right-0 h-full w-5 translate-x-1/2",
            "flex items-center justify-center cursor-col-resize z-20 select-none group"
          )}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          title="Drag to resize sidebar"
        >
          {/* Visual pill */}
          <div className={cn(
            "w-1 h-10 rounded-full transition-all duration-150",
            isResizing
              ? "bg-primary scale-y-110"
              : "bg-border group-hover:bg-primary/70 group-active:bg-primary"
          )} />
        </div>
      )}

      {/* Dialogs */}
      <CreateSiteDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editSite && (
        <EditSiteDialog
          open={!!editSite}
          onClose={() => setEditSite(null)}
          site={editSite}
        />
      )}
      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        requiredTier="pro"
        featureName="More sites"
        featureDescription={`The ${config.name} plan allows up to ${config.maxSites} sites. Upgrade to add more.`}
      />
      <AlertDialog
        open={!!deleteSiteId}
        onOpenChange={(v) => !v && setDeleteSiteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete site?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the site and all of its log entries. This cannot be undone.
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
    </aside>
  );
}
