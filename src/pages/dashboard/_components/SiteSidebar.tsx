import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { MapPin, Plus, Settings, Trash2, ChevronRight, Lock } from "lucide-react";
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

export default function SiteSidebar({ selectedSiteId, onSelectSite, onSiteDeleted, fullscreen }: Props) {
  const sites = useQuery(api.sites.list, {});
  const removeSite = useMutation(api.sites.remove);
  const { config } = useSubscription();
  const [createOpen, setCreateOpen] = useState(false);
  const [editSite, setEditSite] = useState<Doc<"sites"> | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<Id<"sites"> | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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
    <aside className={cn(
      "border-border bg-card flex flex-col",
      fullscreen
        ? "w-full h-full border-r-0"
        : "w-64 shrink-0 border-r h-full"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div>
          <span className="text-sm font-semibold text-foreground">Sites</span>
          {config.maxSites !== null && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              {siteCount}/{config.maxSites}
            </span>
          )}
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
      <div className="flex-1 overflow-y-auto py-2">
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
          sites.map((site) => (
            <div
              key={site._id}
              className={cn(
                "group flex items-center gap-2 mx-2 px-3 py-3 md:py-2.5 rounded-lg cursor-pointer transition-colors",
                selectedSiteId === site._id
                  ? "bg-primary/15 text-foreground"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onSelectSite(site._id)}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-medium truncate">{site.name}</span>
              {selectedSiteId === site._id && (
                <ChevronRight className="w-3 h-3 shrink-0 text-primary" />
              )}

              {/* Site actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-opacity">
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
            </div>
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
        requiredTier="starter"
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
