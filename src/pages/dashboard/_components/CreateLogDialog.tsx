import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
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
  const getUploadUrl = useAction(api.r2.storageActions.getUploadUrl);
  const deleteOrphanedPhotos = useAction(api.r2.storageActions.deleteOrphanedPhotos);
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
  const [locationFromSite, setLocationFromSite] = useState(false);
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
    setLocationFromSite(false);
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
    // Track keys that were freshly uploaded so we can delete them if the save fails
    let freshlyUploadedKeys: string[] = [];
    try {
      // Upload any staged (pending) photos to R2 now that the user confirmed saving
      const resolvedPhotos = await Promise.all(
        photos.map(async (p) => {
          if (!p.file) return p; // already uploaded, pass through
          const { uploadUrl, key, publicUrl } = await getUploadUrl({
            fileName: p.fileName,
            contentType: p.file.type,
            bytes: p.bytes,
          });
          const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": p.file.type },
            body: p.file,
          });
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
          freshlyUploadedKeys.push(key);
          return { ...p, url: publicUrl, key };
        })
      );

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
        photos: resolvedPhotos.length > 0
          ? resolvedPhotos.map((p) => ({ url: p.url, key: p.key, bytes: p.bytes }))
          : undefined,
        location: location.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      // Success — clear the tracking list so cleanup doesn't run
      freshlyUploadedKeys = [];
      toast.success("Log entry saved");
      onCreated?.(siteId as Id<"sites">);
      handleClose();
    } catch (err) {
      // If photos were uploaded but the log save failed, remove them from R2
      if (freshlyUploadedKeys.length > 0) {
        void deleteOrphanedPhotos({ keys: freshlyUploadedKeys }).catch(() => {});
      }
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
        <DialogContent
          className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl">New log entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">

            {/* Offline notice */}
            {!isOnline && (
              <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>
                  You&apos;re offline. This entry and any photos will be saved locally and synced automatically when you reconnect.
                </span>
              </div>
            )}

            {/* Site name — autocomplete with auto-create */}
            <div className="space-y-2">
              <Label htmlFor="log-site" className="text-base flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> Site *
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
                    // Clear autofilled location if user changes the site name manually
                    if (locationFromSite) {
                      setLocation("");
                      setCoords(null);
                      setLocationFromSite(false);
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="h-14 text-xl"
                  required
                />
                {showSuggestions && siteName.trim().length > 0 && !exactMatch && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {/* Exact / substring matches */}
                    {filteredSites.length > 0 && (
                      <>
                        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">
                          Existing sites
                        </p>
                        {filteredSites.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-base hover:bg-accent text-left transition-colors"
                            onMouseDown={() => {
                              setSiteName(s.name);
                              setShowSuggestions(false);
                              if (s.location) {
                                setLocation(s.location);
                                setLocationFromSite(true);
                              }
                              if (s.latitude != null && s.longitude != null) {
                                setCoords({ lat: s.latitude, lng: s.longitude });
                              }
                            }}
                          >
                            <MapPin className="w-4 h-4 text-primary shrink-0" />
                            {s.name}
                          </button>
                        ))}
                      </>
                    )}

                    {/* Fuzzy-only matches (possible typos / similar names) */}
                    {fuzzyMatches.length > 0 && (
                      <>
                        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-900/20 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" /> Did you mean?
                        </p>
                        {fuzzyMatches.map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-base hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left transition-colors"
                            onMouseDown={() => {
                              setSiteName(s.name);
                              setShowSuggestions(false);
                              if (s.location) {
                                setLocation(s.location);
                                setLocationFromSite(true);
                              }
                              if (s.latitude != null && s.longitude != null) {
                                setCoords({ lat: s.latitude, lng: s.longitude });
                              }
                            }}
                          >
                            <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{s.name}</span>
                            <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0">
                              Similar
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Create new option — only when text is typed and no exact match */}
                    {siteName.trim() && !exactMatch && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-base hover:bg-accent text-left transition-colors border-t border-border"
                        onMouseDown={() => {
                          setShowSuggestions(false);
                          siteInputRef.current?.blur();
                        }}
                      >
                        <Plus className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          Create new{" "}
                          <span className="font-semibold text-foreground">
                            &quot;{siteName.trim()}&quot;
                          </span>
                        </span>
                      </button>
                    )}

                    {filteredSites.length === 0 && fuzzyMatches.length === 0 && siteName.trim() && (
                      <p className="px-4 py-3 text-base text-muted-foreground">
                        No matching sites — a new one will be created.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Inline hint below input */}
              {siteName.trim() && !exactMatch && fuzzyMatches.length > 0 && filteredSites.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
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
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  A new site named &quot;{siteName.trim()}&quot; will be created
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-title" className="text-base">Title *</Label>
              <Input
                id="log-title"
                placeholder="Generator fuel level check"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl h-14"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base">Category *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as LogCategory)}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOG_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-base py-3">
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-date" className="text-base">Date & Time *</Label>
                <Input
                  id="log-date"
                  type="datetime-local"
                  value={loggedAt}
                  onChange={(e) => setLoggedAt(e.target.value)}
                  className="h-14 text-base"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base flex items-center gap-2">
                Location
                {locationFromSite && (
                  <span className="text-xs font-normal text-primary border border-primary/30 rounded-full px-2 py-0.5">
                    Autofilled from site
                  </span>
                )}
              </Label>
              <LocationPicker
                value={location}
                onChange={(v) => { setLocation(v); setLocationFromSite(false); }}
                onCoordsChange={(c) => { setCoords(c); setLocationFromSite(false); }}
                placeholder="e.g. Tower 12 – Roof East, 123 Main St"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-content" className="text-base">Notes *</Label>
              <Textarea
                id="log-content"
                placeholder="Describe what was observed, done, or found..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="text-xl min-h-[160px] resize-none"
                required
              />
            </div>

            {/* Photos — gated behind Pro plan; offline uploader shown when offline */}
            <div className="space-y-2">
              <Label className={cn("text-base flex items-center gap-2")}>
                Photos
                {!canAttachPhotos && (
                  <span className="text-xs font-normal text-muted-foreground border border-border rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Starter+
                  </span>
                )}
                {canAttachPhotos && !isOnline && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Storing locally
                  </span>
                )}
              </Label>
              {canAttachPhotos && isOnline ? (
                <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={maxPhotosPerEntry} />
              ) : canAttachPhotos && !isOnline ? (
                <OfflinePhotoUploader photos={offlinePhotos} onChange={setOfflinePhotos} maxPhotos={maxPhotosPerEntry} />
              ) : (
                <button
                  type="button"
                  onClick={() => setPhotoUpgradeOpen(true)}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Lock className="w-6 h-6" />
                  <span className="text-base font-medium">Photo attachments require Pro or higher</span>
                  <span className="text-sm">Click to upgrade</span>
                </button>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" size="lg" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={loading || !siteName.trim() || !title.trim() || !content.trim()}
              >
                {loading ? (photos.some((p) => p.file) ? "Uploading & saving…" : "Saving…") : "Save entry"}
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
