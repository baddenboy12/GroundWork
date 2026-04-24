import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Plus, Settings, Trash2, ChevronRight, Lock, ChevronDown, LayoutList, Info, WifiOff, MoreVertical, Users, Vote,
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
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import CreateSiteDialog from "./CreateSiteDialog.tsx";
import EditSiteDialog from "./EditSiteDialog.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";
import TeamDeleteVoteDialog from "./TeamDeleteVoteDialog.tsx";

const PANEL_WIDTH = 360;

type Props = {
  selectedSiteId: Id<"sites"> | null;
  onSelectSite: (id: Id<"sites">) => void;
  onSiteDeleted?: (id: Id<"sites">) => void;
};

export default function SitePopout({ selectedSiteId, onSelectSite, onSiteDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const sitesRaw = useQuery(api.sites.list, {});
  const sites = useCachedQuery("gw_cache_sites_list", sitesRaw);
  const removeSite = useMutation(api.sites.remove);
  const { config } = useSubscription();
  const isOnline = useOnlineStatus();

  // Active deletion votes for team sites (for in-progress badge)
  const activeVotesRaw = useQuery(api.siteDeleteVotes.listActiveForTeam, {});
  const activeVotesBySite = useMemo(() => {
    if (!activeVotesRaw) return new Map<string, { voteId: Id<"siteDeleteVotes">; approvedCount: number }>();
    return new Map(activeVotesRaw.map((v) => [v.siteId as string, v]));
  }, [activeVotesRaw]);

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
  // Personal-site delete (immediate)
  const [deleteSiteId, setDeleteSiteId] = useState<Id<"sites"> | null>(null);
  // Team-site delete (via vote dialog)
  const [voteSiteId, setVoteSiteId] = useState<Id<"sites"> | null>(null);
  const [voteSiteName, setVoteSiteName] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const siteCount = sites?.length ?? 0;
  const ownSiteCount = sites?.filter((s) => s.isOwner).length ?? 0;
  const totalCount = siteCount + pendingNewSiteNames.length;
  const atSiteLimit = config.maxSites !== null && ownSiteCount >= config.maxSites;
  const selectedSite = sites?.find((s) => s._id === selectedSiteId);

  // Track which site's dropdown menu is open (null = none)
  const [menuOpenSiteId, setMenuOpenSiteId] = useState<string | null>(null);
  const menuClosedAt = useRef(0);

  const handleMenuOpenChange = (siteId: string, isOpen: boolean) => {
    setMenuOpenSiteId(isOpen ? siteId : null);
    if (!isOpen) menuClosedAt.current = Date.now();
  };

  // Close when clicking outside the whole wrapper (skip while dropdown menu or edit dialog is open)
  useEffect(() => {
    if (!open || menuOpenSiteId || editSite) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      // Ignore clicks that happen right after the dropdown menu closed
      if (Date.now() - menuClosedAt.current < 200) return;
      const target = e.target as HTMLElement;
      if (wrapperRef.current?.contains(target)) return;
      // Ignore clicks on dialog overlays/content (Radix portals)
      if (target.closest("[role='dialog']") || target.closest("[data-radix-portal]") || target.dataset.state === "open") return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, menuOpenSiteId, editSite]);

  // Scroll to selected site when panel opens
  useEffect(() => {
    if (!open || !selectedSiteId) return;
    const id = setTimeout(() => {
      const el = itemRefs.current.get(selectedSiteId);
      if (el && listRef.current) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 120);
    return () => clearTimeout(id);
  }, [open, selectedSiteId]);

  const handleAddSite = useCallback(() => {
    if (!isOnline) {
      toast.error("You're offline — creating sites requires a connection");
      return;
    }
    if (atSiteLimit) {
      setUpgradeOpen(true);
    } else {
      setCreateOpen(true);
      setOpen(false);
    }
  }, [atSiteLimit, isOnline]);

  const handlePersonalDelete = async () => {
    if (!deleteSiteId) return;
    if (!isOnline) {
      toast.error("You're offline — deletion requires a connection");
      setDeleteSiteId(null);
      return;
    }
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
          "flex items-center gap-3.5 h-[5rem] px-10 rounded-2xl text-3xl font-semibold transition-all duration-200 scale-[0.85] border border-white/10",
          "hover:brightness-110 active:scale-[0.80]",
          open && "border-border shadow-inner"
        )}
        style={{ background: "linear-gradient(160deg, hsl(30 14% 18%) 0%, hsl(30 12% 10%) 50%, hsl(30 14% 14%) 100%)" }}
      >
        <LayoutList className="w-7 h-7 text-primary shrink-0" />
        <span className="max-w-44 truncate">
          {selectedSite?.name ?? "Sites"}
        </span>
        {totalCount > 0 && (
          <span className="text-xl font-mono bg-background/60 px-2.5 py-1 rounded-md text-muted-foreground shrink-0">
            {totalCount}
          </span>
        )}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>

      {/* ── Info tooltip beside trigger ──────────────────────────────────── */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-20 h-20 -ml-4 flex items-center justify-center rounded-2xl text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted active:scale-90 transition-all"
            aria-label="How sites work"
          >
            <Info style={{ width: 32, height: 32 }} />
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
            className="absolute"
            style={{
              width: PANEL_WIDTH,
              zIndex: 100,
              transformOrigin: "50px top",
              left: "75px",
              top: "calc(100% + 22px)",
            }}
            initial={{ scaleX: 0.85, scaleY: 0.7, opacity: 0, y: -8 }}
            animate={{ scaleX: 1, scaleY: 1, opacity: 1, y: 0 }}
            exit={{ scaleX: 0.85, scaleY: 0.7, opacity: 0, y: -8 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 0.5,
            }}
          >
            {/* Notch pointing up toward Filters area */}
            <div style={{
              position: "absolute",
              top: -10,
              left: 55,
              width: 22,
              height: 22,
              backgroundColor: "hsl(30 14% 17%)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              transform: "rotate(45deg)",
              zIndex: 0,
            }} />
            {/* Panel body */}
            <div
              className="shadow-2xl"
              style={{
                overflow: "hidden",
                position: "relative",
                zIndex: 1,
                borderRadius: "24px",
                background: "linear-gradient(to bottom, hsl(30 14% 15%) 0%, hsl(30 12% 10%) 80px)",
                border: "1px solid var(--border)",
              }}
            >
            {/* Panel header */}
            <motion.div
              className="flex items-center justify-between px-5 py-4 border-b border-border"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.03 }}
            >
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                All Sites
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddSite}
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors active:scale-90",
                    atSiteLimit
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 hover:bg-primary/20 active:bg-primary/30 text-primary"
                  )}
                  aria-label="Add site"
                >
                  {atSiteLimit ? <Lock className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            {/* Site list */}
            <div ref={listRef} className="py-2 max-h-[65vh] overflow-y-auto px-1">
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
                    const isTeamSite = !!site.teamKeyId;
                    const activeVote = activeVotesBySite.get(site._id);
                    const isMenuOpen = menuOpenSiteId === site._id;
                    return (
                      <motion.div
                        key={site._id}
                        ref={(el) => {
                          if (el) itemRefs.current.set(site._id, el);
                          else itemRefs.current.delete(site._id);
                        }}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.008, duration: 0.1, ease: "easeOut" }}
                        whileTap={{ scale: 0.97, transition: { duration: 0.08 } }}
                        className={cn(
                          "group relative flex items-center gap-3 mx-2 px-4 py-5 rounded-xl cursor-pointer",
                          "border transition-all duration-200",
                          isMenuOpen
                            ? "border-primary/40 bg-primary/8 text-foreground shadow-sm"
                            : isSelected
                              ? "border-primary/35 bg-primary/12 text-foreground shadow-sm"
                              : "border-border/20 hover:border-border/55 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        )}
                        onClick={() => {
                          onSelectSite(site._id);
                          setTimeout(() => setOpen(false), 120);
                        }}
                      >
                        {/* Slide-in indicator bar */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              className="absolute left-1 inset-y-2.5 w-[3px] rounded-full bg-primary"
                              initial={{ scaleY: 0, opacity: 0 }}
                              animate={{ scaleY: 1, opacity: 1 }}
                              exit={{ scaleY: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </AnimatePresence>
                        {/* Site name + owner hint */}
                        <div className="flex-1 min-w-0">
                          <span className="text-lg font-semibold truncate leading-tight block">
                            {site.name}
                          </span>
                          {!site.isOwner && (
                            <span className="text-sm text-muted-foreground truncate block leading-tight mt-0.5">
                              {site.ownerName}
                            </span>
                          )}
                        </div>

                        {/* Vote-in-progress badge */}
                        {activeVote && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                            <Vote className="w-2.5 h-2.5" />
                            {activeVote.approvedCount} voted
                          </span>
                        )}

                        {/* Team badge (no active vote) */}
                        {isTeamSite && !activeVote && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md">
                            <Users className="w-2.5 h-2.5" />
                            Team
                          </span>
                        )}

                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          >
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-primary" />
                          </motion.div>
                        )}

                        {/* ⋮ actions menu */}
                        <DropdownMenu onOpenChange={(isOpen) => handleMenuOpenChange(site._id, isOpen)}>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button
                              className={cn(
                                "w-12 h-12 flex items-center justify-center rounded-xl shrink-0 transition-colors active:scale-90",
                                isMenuOpen
                                  ? "bg-primary/20 text-primary"
                                  : "bg-transparent hover:bg-accent active:bg-accent",
                                !isMenuOpen && (isSelected
                                  ? "text-primary/50 hover:text-primary"
                                  : "text-muted-foreground/40 hover:text-foreground")
                              )}
                              aria-label="Site actions"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 p-3 rounded-2xl" style={{ backgroundColor: "hsl(30 12% 8%)", border: "1px solid var(--border)" }}>
                            {/* Edit — owner only */}
                            <DropdownMenuItem
                              className={cn("py-4 text-base cursor-pointer rounded-xl", (!isOnline || !site.isOwner) && "opacity-50")}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isOnline) {
                                  toast.error("You're offline — editing requires a connection");
                                  return;
                                }
                                if (!site.isOwner) {
                                  toast.error("Only the site owner can edit it");
                                  return;
                                }
                                setEditSite(site);
                              }}
                            >
                              <Settings className="w-4 h-4 mr-2.5" /> Edit site
                            </DropdownMenuItem>

                            {/* Delete — personal sites: immediate; team sites: vote */}
                            <DropdownMenuItem
                              className={cn(
                                "py-4 text-base cursor-pointer rounded-xl text-destructive focus:text-destructive",
                                !isOnline && "opacity-50",
                                !isTeamSite && !site.isOwner && "opacity-50"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isOnline) {
                                  toast.error("You're offline — deletion requires a connection");
                                  return;
                                }
                                if (isTeamSite) {
                                  // Team site → open vote dialog
                                  setVoteSiteId(site._id);
                                  setVoteSiteName(site.name);
                                  setOpen(false);
                                  return;
                                }
                                if (!site.isOwner) {
                                  toast.error("Only the site owner can delete it");
                                  return;
                                }
                                setDeleteSiteId(site._id);
                              }}
                            >
                              {isTeamSite ? (
                                <>
                                  <Vote className="w-4 h-4 mr-2.5" />
                                  {activeVote ? `Vote in progress (${activeVote.approvedCount})` : "Propose deletion"}
                                </>
                              ) : (
                                <><Trash2 className="w-4 h-4 mr-2.5" /> Delete</>
                              )}
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
                      className="flex items-center gap-3 mx-2 px-3 py-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 cursor-default"
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

      {/* Personal-site direct delete */}
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
              onClick={handlePersonalDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team-site vote dialog */}
      <TeamDeleteVoteDialog
        open={!!voteSiteId}
        onClose={() => setVoteSiteId(null)}
        siteId={voteSiteId}
        siteName={voteSiteName}
        onDeleted={(id) => {
          onSiteDeleted?.(id);
          setVoteSiteId(null);
        }}
      />
    </div>
  );
}
