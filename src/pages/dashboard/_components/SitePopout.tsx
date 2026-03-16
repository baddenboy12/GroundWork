import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Plus, Settings, Trash2, ChevronRight, Lock, ChevronDown, LayoutList,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import CreateSiteDialog from "./CreateSiteDialog.tsx";
import EditSiteDialog from "./EditSiteDialog.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";

const PANEL_WIDTH = 276;

type Props = {
  selectedSiteId: Id<"sites"> | null;
  onSelectSite: (id: Id<"sites">) => void;
  onSiteDeleted?: (id: Id<"sites">) => void;
};

export default function SitePopout({ selectedSiteId, onSelectSite, onSiteDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const sites = useQuery(api.sites.list, {});
  const removeSite = useMutation(api.sites.remove);
  const { config } = useSubscription();

  const [createOpen, setCreateOpen] = useState(false);
  const [editSite, setEditSite] = useState<Doc<"sites"> | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<Id<"sites"> | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const siteCount = sites?.length ?? 0;
  const atSiteLimit = config.maxSites !== null && siteCount >= config.maxSites;
  const selectedSite = sites?.find((s) => s._id === selectedSiteId);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const handleAddSite = () => {
    if (atSiteLimit) {
      setUpgradeOpen(true);
    } else {
      setCreateOpen(true);
      setOpen(false);
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
    <div className="relative" style={{ zIndex: 50 }}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-semibold transition-all duration-200",
          "bg-muted/70 hover:bg-muted border border-transparent",
          open && "bg-muted border-border shadow-inner"
        )}
      >
        <LayoutList className="w-4 h-4 text-primary shrink-0" />
        <span className="max-w-32 truncate">
          {selectedSite?.name ?? "Sites"}
        </span>
        {siteCount > 0 && (
          <span className="text-[10px] font-mono bg-background/60 px-1.5 py-0.5 rounded-md text-muted-foreground shrink-0">
            {siteCount}
          </span>
        )}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.div>
      </button>

      {/* ── Floating panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="absolute left-0 top-[calc(100%+6px)] bg-card border border-border rounded-2xl shadow-2xl"
            style={{ width: PANEL_WIDTH, overflow: "hidden" }}
            /* Phase 1: horizontal sweep from left */
            initial={{ clipPath: "inset(0 100% 0 0 round 16px)", opacity: 0 }}
            animate={{ clipPath: "inset(0 0% 0 0 round 16px)", opacity: 1 }}
            exit={{ clipPath: "inset(0 100% 0 0 round 16px)", opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Panel header */}
            <motion.div
              className="flex items-center justify-between px-4 py-3 border-b border-border"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                All Sites
              </span>
              <div className="flex items-center gap-2">
                {siteCount > 0 && (
                  <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                    {siteCount}
                    {config.maxSites !== null ? `/${config.maxSites}` : ""}
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
                  {atSiteLimit ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                </button>
              </div>
            </motion.div>

            {/* Phase 2: items cascade downward */}
            <div className="py-2 max-h-[65vh] overflow-y-auto">
              {sites === undefined ? (
                <div className="px-4 space-y-2 py-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-xl" />
                  ))}
                </div>
              ) : sites.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No sites yet. Sites are created automatically when you add your first log entry.
                  </p>
                </div>
              ) : (
                sites.map((site, i) => (
                  <motion.div
                    key={site._id}
                    /* each item slides in from the top, staggered */
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.18 + i * 0.045,
                      duration: 0.22,
                      ease: "easeOut",
                    }}
                    className={cn(
                      "group flex items-center gap-3 mx-2 px-3 py-3 rounded-xl cursor-pointer transition-colors",
                      selectedSiteId === site._id
                        ? "bg-primary/15 text-foreground"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => {
                      onSelectSite(site._id);
                      setOpen(false);
                    }}
                  >
                    {/* index */}
                    <span
                      className={cn(
                        "text-[10px] font-mono tabular-nums shrink-0 w-5 text-right leading-none",
                        selectedSiteId === site._id
                          ? "text-primary/60"
                          : "text-muted-foreground/35 group-hover:text-muted-foreground/55"
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <span className="flex-1 text-sm font-semibold truncate">
                      {site.name}
                    </span>

                    {selectedSiteId === site._id && (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-primary" />
                    )}

                    {/* per-site actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className="opacity-0 group-hover:opacity-80 p-1 rounded-lg hover:bg-accent transition-opacity">
                          <Settings className="w-3.5 h-3.5" />
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
          </motion.div>
        )}
      </AnimatePresence>

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
              This will permanently delete the site and all of its log entries.
              This cannot be undone.
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
