import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { enqueueOfflineEntry, type OfflinePhoto } from "@/hooks/use-offline-queue.ts";
import OfflinePhotoUploader from "./OfflinePhotoUploader.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { LOG_CATEGORIES, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import { findFuzzyMatches } from "../_lib/fuzzy-match.ts";
import PhotoUploader, { type R2Photo } from "./PhotoUploader.tsx";
import LocationPicker from "./LocationPicker.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { AlertTriangle, Lock, MapPin, Plus, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pre-populate the site field (e.g. when opening from a site's log list) */
  initialSiteName?: string;
  /** Called with the site id after a log is saved, so the sidebar can navigate to it */
  onCreated?: (siteId: Id<"sites">) => void;
};

export default function CreateLogDialog({
  open,
  onClose,
  initialSiteName,
  onCreated,
}: Props) {
  const createLog = useMutation(api.logs.create);
  const findOrCreateSite = useMutation(api.sites.findOrCreate);
  const sites = useQuery(api.sites.list, {});
  const { isAtLeast, config } = useSubscription();
  const canAttachPhotos = isAtLeast("pro");
  const maxPhotosPerEntry = config.maxPhotosPerEntry ?? 15;

  const [siteName, setSiteName] = useState(initialSiteName ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<LogCategory>("general");
  const [loggedAt, setLoggedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<R2Photo[]>([]);
  const [offlinePhotos, setOfflinePhotos] = useState<OfflinePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoUpgradeOpen, setPhotoUpgradeOpen] = useState(false);
  const [siteUpgradeOpen, setSiteUpgradeOpen] = useState(false);

  const siteInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();

  // Sync initialSiteName when dialog opens
  useEffect(() => {
    if (open) {
      setSiteName(initialSiteName ?? "");
    }
  }, [open, initialSiteName]);

  const filteredSites =
    sites?.filter((s) =>
      s.name.toLowerCase().includes(siteName.toLowerCase().trim())
    ) ?? [];

  const exactMatch = sites?.some(
    (s) => s.name.toLowerCase() === siteName.trim().toLowerCase()
  );

  // Sites that are NOT caught by the substring filter but are fuzzy-similar
  const fuzzyMatches =
    siteName.trim().length >= 2
      ? findFuzzyMatches(siteName, sites ?? [], (s) => s.name)
      : [];

  const handleClose = () => {
    setTitle("");
    setContent("");
    setCategory("general");
    setLoggedAt(new Date().toISOString().slice(0, 16));
    setPhotos([]);
    setOfflinePhotos([]);
    setSiteName(initialSiteName ?? "");
    setShowSuggestions(false);
    setLocation("");
    setCoords(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !title.trim() || !content.trim()) return;
    setLoading(true);

    // ── Offline path: queue entry locally ─────────────────────────────────
    if (!isOnline) {
      enqueueOfflineEntry({
        siteName: siteName.trim(),
        siteLocation: location.trim() || undefined,
        siteLat: coords?.lat,
        siteLng: coords?.lng,
        title: title.trim(),
        content: content.trim(),
        category,
        loggedAt: new Date(loggedAt).toISOString(),
        location: location.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
        photos: offlinePhotos.length > 0 ? offlinePhotos : undefined,
      });
      toast.success("Entry saved offline — will sync when reconnected");
      handleClose();
      setLoading(false);
      return;
    }

    // ── Online path: save to Convex ────────────────────────────────────────
    try {
      const siteId = await findOrCreateSite({
        name: siteName.trim(),
        location: location.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      await createLog({
        siteId: siteId as Id<"sites">,
        title: title.trim(),
        content: content.trim(),
        category,
        loggedAt: new Date(loggedAt).toISOString(),
        photos: photos.length > 0
          ? photos.map((p) => ({ url: p.url, key: p.key, bytes: p.bytes }))
          : undefined,
        location: location.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      toast.success("Log entry saved");
      onCreated?.(siteId as Id<"sites">);
      handleClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; message?: string };
        if (data.code === "FORBIDDEN") {
          setSiteUpgradeOpen(true);
          return;
        }
        toast.error(data.message ?? "Failed to save log entry");
      } else {
        toast.error("Failed to save log entry");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New log entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">

            {/* Offline notice */}
            {!isOnline && (
              <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>
                  You&apos;re offline. This entry and any photos will be saved locally and synced automatically when you reconnect.
                </span>
              </div>
            )}

            {/* Site name — autocomplete with auto-create */}
            <div className="space-y-1.5">
              <Label htmlFor="log-site" className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Site *
              </Label>
              <div className="relative">
                <Input
                  id="log-site"
                  ref={siteInputRef}
                  placeholder="Type a site name, e.g. Tower 12 – Roof East"
                  value={siteName}
                  autoComplete="off"
                  onChange={(e) => {
                    setSiteName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  required
                />
                {showSuggestions && (siteName.length > 0 || filteredSites.length > 0) && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {/* Exact / substring matches */}
                    {filteredSites.length > 0 && (
                      <>
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">
                          Existing sites
                        </p>
                        {filteredSites.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                            onMouseDown={() => {
                              setSiteName(s.name);
                              setShowSuggestions(false);
                            }}
                          >
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            {s.name}
                          </button>
                        ))}
                      </>
                    )}

                    {/* Fuzzy-only matches (possible typos / similar names) */}
                    {fuzzyMatches.length > 0 && (
                      <>
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-900/20 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" /> Did you mean?
                        </p>
                        {fuzzyMatches.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left transition-colors"
                            onMouseDown={() => {
                              setSiteName(s.name);
                              setShowSuggestions(false);
                            }}
                          >
                            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{s.name}</span>
                            <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                              Similar
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Create new option */}
                    {siteName.trim() && !exactMatch && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent text-left transition-colors border-t border-border"
                        onMouseDown={() => {
                          setShowSuggestions(false);
                          siteInputRef.current?.blur();
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>
                          Create new{" "}
                          <span className="font-semibold text-foreground">
                            &quot;{siteName.trim()}&quot;
                          </span>
                        </span>
                      </button>
                    )}

                    {filteredSites.length === 0 && fuzzyMatches.length === 0 && !siteName.trim() && (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        Start typing a site name…
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Inline hint below input */}
              {siteName.trim() && !exactMatch && fuzzyMatches.length > 0 && filteredSites.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Similar to{" "}
                  {fuzzyMatches.slice(0, 2).map((s, i) => (
                    <span key={s._id}>
                      <button
                        type="button"
                        className="font-semibold underline underline-offset-2 hover:no-underline"
                        onClick={() => setSiteName(s.name)}
                      >
                        {s.name}
                      </button>
                      {i < Math.min(fuzzyMatches.length, 2) - 1 && ", "}
                    </span>
                  ))}
                  {" "}&mdash; did you mean one of these?
                </p>
              )}
              {siteName.trim() && !exactMatch && fuzzyMatches.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Plus className="w-3 h-3 text-primary" />
                  A new site named &quot;{siteName.trim()}&quot; will be created
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-title">Title *</Label>
              <Input
                id="log-title"
                placeholder="Generator fuel level check"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as LogCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOG_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="log-date">Date & Time *</Label>
                <Input
                  id="log-date"
                  type="datetime-local"
                  value={loggedAt}
                  onChange={(e) => setLoggedAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <LocationPicker
                value={location}
                onChange={setLocation}
                onCoordsChange={setCoords}
                placeholder="e.g. Tower 12 – Roof East, 123 Main St"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-content">Notes *</Label>
              <Textarea
                id="log-content"
                placeholder="Describe what was observed, done, or found..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Photos — gated behind Pro plan; offline uploader shown when offline */}
            <div className="space-y-1.5">
              <Label className={cn("flex items-center gap-2")}>
                Photos
                {!canAttachPhotos && (
                  <span className="text-[10px] font-normal text-muted-foreground border border-border rounded-full px-1.5 py-0.5 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Starter+
                  </span>
                )}
                {canAttachPhotos && !isOnline && (
                  <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                    <WifiOff className="w-2.5 h-2.5" /> Storing locally
                  </span>
                )}
              </Label>
              {canAttachPhotos && isOnline ? (
                <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={maxPhotosPerEntry} />
              ) : canAttachPhotos && !isOnline ? (
                <OfflinePhotoUploader photos={offlinePhotos} onChange={setOfflinePhotos} />
              ) : (
                <button
                  type="button"
                  onClick={() => setPhotoUpgradeOpen(true)}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Lock className="w-5 h-5" />
                  <span className="text-sm font-medium">Photo attachments require Pro or higher</span>
                  <span className="text-xs">Click to upgrade</span>
                </button>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !siteName.trim() || !title.trim() || !content.trim()}
              >
                {loading ? "Saving..." : "Save entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={photoUpgradeOpen}
        onClose={() => setPhotoUpgradeOpen(false)}
        requiredTier="pro"
        featureName="Photo attachments"
        featureDescription="Attach photos to log entries on the Pro plan and above."
      />
      <UpgradeDialog
        open={siteUpgradeOpen}
        onClose={() => setSiteUpgradeOpen(false)}
        requiredTier="pro"
        featureName="More sites"
        featureDescription="You've reached your site limit. Upgrade to add more sites."
      />
    </>
  );
}
