import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Plus, Settings, Trash2, ChevronRight, Lock, ChevronDown, LayoutList, Info, WifiOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
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
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { useCachedQuery } from "@/hooks/use-cached-query.ts";
import { useOfflineQueueState } from "@/hooks/use-offline-queue.ts";
import CreateSiteDialog from "./CreateSiteDialog.tsx";
import EditSiteDialog from "./EditSiteDialog.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";

const PANEL_WIDTH = 300;

type Props = {
  selectedSiteId: Id<"sites"> | null;
  onSelectSite: (id: Id<"sites">) => void;
  onSiteDeleted?: (id: Id<"sites">) => void;
};

export default function SitePopout({ selectedSiteId, onSelectSite, onSiteDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Map site._id → DOM element for scroll-to-selected
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const sitesRaw = useQuery(api.sites.list, {});
  const sites = useCachedQuery("gw_cache_sites_list", sitesRaw);
  const removeSite = useMutation(api.sites.remove);
  const { config } = useSubscription();

  // Offline queue: find sites that only exist in the queue (not yet in DB)
  const offlineQueue = useOfflineQueueState();
  const pendingNewSiteNames = useMemo(() => {
    const existingNames = new Set((sites ?? []).map((s) => s.name.toLowerCase()));
    const seen = new Set<string>();
    return offlineQueue
      .filter((e) => {
        const lower = e.siteName.toLowerCase();
        if (existingNames.has(lower) || seen.has(lower)) return false;
        seen.add(lower);
        return true;
      })
      .map((e) => e.siteName);
  }, [offlineQueue, sites]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editSite, setEditSite] = useState<Doc<"sites"> | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<Id<"sites"> | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const siteCount = sites?.length ?? 0;
  const totalCount = siteCount + pendingNewSiteNames.length;
  const atSiteLimit = config.maxSites !== null && siteCount >= config.maxSites;
  const selectedSite = sites?.find((s) => s._id === selectedSiteId);

  // Close when clicking outside the whole wrapper
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Scroll to selected site when panel opens
  useEffect(() => {
    if (!open || !selectedSiteId) return;
    // Wait for panel to animate in (~120 ms)
    const id = setTimeout(() => {
      const el = itemRefs.current.get(selectedSiteId);
      if (el && listRef.current) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 120);
    return () => clearTimeout(id);
  }, [open, selectedSiteId]);

  const handleAddSite = useCallback(() => {
    if (atSiteLimit) {
      setUpgradeOpen(true);
    } else {
      setCreateOpen(true);
      setOpen(false);
    }
  }, [atSiteLimit]);

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
    <div ref={wrapperRef} className="flex items-center gap-1" style={{ zIndex: 50, position: "relative" }}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2.5 h-11 px-4 rounded-xl text-base font-semibold transition-all duration-200",
          "bg-muted/70 hover:bg-muted border border-transparent",
          open && "bg-muted border-border shadow-inner"
        )}
      >
        <LayoutList className="w-5 h-5 text-primary shrink-0" />
        <span className="max-w-44 truncate">
          {selectedSite?.name ?? "Sites"}
        </span>
        {totalCount > 0 && (
          <span className="text-[11px] font-mono bg-background/60 px-1.5 py-0.5 rounded-md text-muted-foreground shrink-0">
            {totalCount}
          </span>
        )}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* ── Info tooltip beside trigger ──────────────────────────────────── */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors"
            aria-label="How sites work"
          >
            <Info className="w-5 h-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-72 p-4 space-y-3 text-sm">
          <p className="font-semibold text-foreground">How Sites Work</p>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Site name = grouping key</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All log entries with the same site name are grouped under one site. Renaming a site updates every log entry under it instantly.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Smart features</p>
            <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              {[
                ["Auto-create on first log", "Type a new site name in the log dialog and the site is created automatically."],
                ["Autocomplete selector", "The site field suggests existing sites as you type to prevent duplicates."],
                ["Fuzzy-match warning", "If a name is close to an existing site a 'Did you mean?' hint appears."],
                ["GPS & map location", "Each site and log entry can store GPS coordinates from a live map."],
                ["Bulk rename via Edit Site", "Renaming a site updates all its log entries at once."],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-2">
                  <span className="text-primary shrink-0">→</span>
                  <span><strong className="text-foreground">{title}</strong> — {desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </PopoverContent>
      </Popover>

      {/* ── Floating panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute left-0 top-[calc(100%+4px)] bg-card border border-border rounded-2xl shadow-2xl"
            style={{ width: PANEL_WIDTH, overflow: "hidden", zIndex: 100 }}
            initial={{ clipPath: "inset(0 0 100% 0 round 16px)", opacity: 0 }}
            animate={{ clipPath: "inset(0 0 0% 0 round 16px)", opacity: 1 }}
            exit={{ clipPath: "inset(0 0 100% 0 round 16px)", opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Panel header */}
            <motion.div
              className="flex items-center justify-between px-4 py-3 border-b border-border"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.03 }}
            >
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                All Sites
              </span>
              <div className="flex items-center gap-2">
                {siteCount > 0 && (
                  <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                    {totalCount}{config.maxSites !== null ? `/${config.maxSites}` : ""}
                  </span>
                )}
                <button
                  onClick={handleAddSite}
                  className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                    atSiteLimit
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 hover:bg-primary/20 text-primary"
                  )}
                >
                  {atSiteLimit ? <Lock className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                </button>
              </div>
            </motion.div>

            {/* Site list */}
            <div ref={listRef} className="py-2 max-h-[65vh] overflow-y-auto">
              {sites === undefined ? (
                <div className="px-3 space-y-1.5 py-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : sites.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No sites yet. Sites are created automatically when you add your first log entry.
                  </p>
                </div>
              ) : (
                <>
                  {sites.map((site, i) => {
                    const isSelected = selectedSiteId === site._id;
                    return (
                      <motion.div
                        key={site._id}
                        ref={(el) => {
                          if (el) itemRefs.current.set(site._id, el);
                          else itemRefs.current.delete(site._id);
                        }}
                        /* Fast stagger — base 80ms + 20ms per item */
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.008, duration: 0.1, ease: "easeOut" }}
                        /* Press animation */
                        whileTap={{ scale: 0.96, transition: { duration: 0.08 } }}
                        className={cn(
                          "group flex items-center gap-3 mx-2 px-3 py-3 rounded-xl cursor-pointer",
                          "border transition-all duration-200",
                          isSelected
                            ? "border-primary/35 bg-primary/12 text-foreground shadow-sm"
                            : "border-border/20 hover:border-border/55 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        )}
                        onClick={() => {
                          onSelectSite(site._id);
                          setOpen(false);
                        }}
                      >
                        {/* index */}
                        <span className={cn(
                          "text-[10px] font-mono tabular-nums shrink-0 w-5 text-right leading-none",
                          isSelected
                            ? "text-primary/60"
                            : "text-muted-foreground/35 group-hover:text-muted-foreground/60"
                        )}>
                          {String(i + 1).padStart(2, "0")}
                        </span>

                        {/* Site name — larger */}
                        <span className="flex-1 text-[15px] font-semibold truncate leading-tight">
                          {site.name}
                        </span>

                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          >
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-primary" />
                          </motion.div>
                        )}

                        {/* per-site actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="opacity-0 group-hover:opacity-70 p-1 rounded-lg hover:bg-accent transition-opacity shrink-0">
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditSite(site); }}>
                              <Settings className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteSiteId(site._id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </motion.div>
                    );
                  })}

                  {/* Pending new sites from offline queue */}
                  {pendingNewSiteNames.map((name, i) => (
                    <motion.div
                      key={`pending-site-${name}`}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (siteCount + i) * 0.008, duration: 0.1, ease: "easeOut" }}
                      className="flex items-center gap-3 mx-2 px-3 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 cursor-default"
                      title="This site is queued offline and will sync when back online"
                    >
                      <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-500/70" />
                      <span className="flex-1 text-[15px] font-semibold truncate leading-tight text-muted-foreground">
                        {name}
                      </span>
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md shrink-0">
                        pending
                      </span>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <CreateSiteDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editSite && (
        <EditSiteDialog open={!!editSite} onClose={() => setEditSite(null)} site={editSite} />
      )}
      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        requiredTier="pro"
        featureName="More sites"
        featureDescription={`The ${config.name} plan allows up to ${config.maxSites} sites. Upgrade to add more.`}
      />
      <AlertDialog open={!!deleteSiteId} onOpenChange={(v) => !v && setDeleteSiteId(null)}>
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
    </div>
  );
}
