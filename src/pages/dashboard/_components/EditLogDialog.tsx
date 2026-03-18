import { useState, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
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
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { LOG_CATEGORIES, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import LocationPicker from "./LocationPicker.tsx";
import PhotoUploader, { type R2Photo } from "./PhotoUploader.tsx";
import { Lock } from "lucide-react";

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  log: LogWithAuthor;
};

/** Convert stored log photos to R2Photo objects for the PhotoUploader */
function logPhotosToR2(log: LogWithAuthor): R2Photo[] {
  return (log.photos ?? []).map((p) => ({
    url: p.url,
    key: p.key,
    bytes: p.bytes,
    previewUrl: p.url,
    fileName: p.key.split("/").pop() ?? "photo",
  }));
}

export default function EditLogDialog({ open, onClose, log }: Props) {
  const updateLog = useMutation(api.logs.update);
  const getUploadUrl = useAction(api.r2.storageActions.getUploadUrl);
  const deleteOrphanedPhotos = useAction(api.r2.storageActions.deleteOrphanedPhotos);
  const sites = useQuery(api.sites.list, {});
  const isOnline = useOnlineStatus();
  const { isAtLeast, config } = useSubscription();
  const canAttachPhotos = isAtLeast("pro");
  const maxPhotosPerEntry = config.maxPhotosPerEntry ?? 15;

  const [title, setTitle] = useState(log.title);
  const [content, setContent] = useState(log.content);
  const [category, setCategory] = useState<LogCategory>(log.category as LogCategory);
  const [siteId, setSiteId] = useState<Id<"sites">>(log.siteId);
  const [loggedAt, setLoggedAt] = useState(
    () => new Date(log.loggedAt).toISOString().slice(0, 16)
  );
  const [location, setLocation] = useState(log.location ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    log.latitude != null && log.longitude != null
      ? { lat: log.latitude, lng: log.longitude }
      : null
  );
  const [photos, setPhotos] = useState<R2Photo[]>(() => logPhotosToR2(log));
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset state whenever the dialog opens with a (potentially different) log
  useEffect(() => {
    if (open) {
      setTitle(log.title);
      setContent(log.content);
      setCategory(log.category as LogCategory);
      setSiteId(log.siteId);
      setLoggedAt(new Date(log.loggedAt).toISOString().slice(0, 16));
      setLocation(log.location ?? "");
      setCoords(
        log.latitude != null && log.longitude != null
          ? { lat: log.latitude, lng: log.longitude }
          : null
      );
      setPhotos(logPhotosToR2(log));
      setRemovedKeys([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, log._id]);

  /** Track which existing (already-uploaded) photos the user removes */
  const handlePhotosChange = (newPhotos: R2Photo[]) => {
    const newKeySet = new Set(newPhotos.map((p) => p.key).filter(Boolean));
    const removed = photos
      .filter((p) => !p.file && p.key && !newKeySet.has(p.key))
      .map((p) => p.key);
    if (removed.length > 0) {
      setRemovedKeys((prev) => [...prev, ...removed]);
    }
    setPhotos(newPhotos);
  };

  const handleClose = () => {
    setTitle(log.title);
    setContent(log.content);
    setCategory(log.category as LogCategory);
    setSiteId(log.siteId);
    setLoggedAt(new Date(log.loggedAt).toISOString().slice(0, 16));
    setLocation(log.location ?? "");
    setCoords(
      log.latitude != null && log.longitude != null
        ? { lat: log.latitude, lng: log.longitude }
        : null
    );
    setPhotos(logPhotosToR2(log));
    setRemovedKeys([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (!isOnline) {
      toast.error("You're offline — saving changes requires a connection");
      return;
    }
    setLoading(true);
    let freshlyUploadedKeys: string[] = [];
    try {
      // Upload any newly staged photos to R2
      const resolvedPhotos = await Promise.all(
        photos.map(async (p) => {
          if (!p.file) {
            // Already uploaded — pass through as-is
            return { url: p.url, key: p.key, bytes: p.bytes };
          }
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
          return { url: publicUrl, key, bytes: p.bytes };
        })
      );

      await updateLog({
        logId: log._id,
        siteId,
        title: title.trim(),
        content: content.trim(),
        category,
        loggedAt: new Date(loggedAt).toISOString(),
        location: location.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
        photos: resolvedPhotos.length > 0 ? resolvedPhotos : undefined,
      });

      // Success — delete removed R2 photos (best-effort, non-blocking)
      if (removedKeys.length > 0) {
        void deleteOrphanedPhotos({ keys: removedKeys }).catch(() => {});
      }
      freshlyUploadedKeys = [];
      toast.success("Log entry updated");
      onClose();
    } catch {
      // Roll back freshly uploaded photos that couldn't be saved to the DB
      if (freshlyUploadedKeys.length > 0) {
        void deleteOrphanedPhotos({ keys: freshlyUploadedKeys }).catch(() => {});
      }
      toast.error("Failed to update log entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        style={{ top: "4vh", transform: "translateX(-50%)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit log entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="edit-log-title" className="text-base">Title *</Label>
            <Input
              id="edit-log-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl h-14"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base">Site *</Label>
            <Select
              value={siteId}
              onValueChange={(v) => setSiteId(v as Id<"sites">)}
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select a site" />
              </SelectTrigger>
              <SelectContent>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s._id} value={s._id} className="text-base py-3">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Label htmlFor="edit-log-date" className="text-base">Date & Time *</Label>
              <Input
                id="edit-log-date"
                type="datetime-local"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                className="h-14 text-base"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Location</Label>
            <LocationPicker
              value={location}
              onChange={setLocation}
              onCoordsChange={setCoords}
              initialCoords={coords}
              placeholder="e.g. Tower 12 – Roof East, 123 Main St"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-log-content" className="text-base">Notes *</Label>
            <Textarea
              id="edit-log-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              className="text-xl min-h-[180px] resize-none"
              required
            />
          </div>

          {/* Photos — editable on Pro+; read-only thumbnails on lower tiers */}
          <div className="space-y-2">
            <Label className="text-base flex items-center gap-2">
              Photos
              {!canAttachPhotos && (
                <span className="text-xs font-normal text-muted-foreground border border-border rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> View only
                </span>
              )}
            </Label>
            {canAttachPhotos ? (
              <PhotoUploader
                photos={photos}
                onChange={handlePhotosChange}
                maxPhotos={maxPhotosPerEntry}
              />
            ) : (
              // Read-only thumbnail strip for non-Pro users
              photos.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {photos.map((p, i) => (
                    <img
                      key={p.previewUrl}
                      src={p.previewUrl}
                      alt={`Photo ${i + 1}`}
                      className="w-20 h-20 rounded-lg object-cover border border-border"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No photos attached.</p>
              )
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" size="lg" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={loading || !title.trim() || !content.trim() || !isOnline}
            >
              {loading
                ? photos.some((p) => p.file)
                  ? "Uploading & saving…"
                  : "Saving…"
                : !isOnline
                  ? "Offline"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
