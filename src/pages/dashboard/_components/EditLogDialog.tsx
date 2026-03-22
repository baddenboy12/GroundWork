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
  // Photos are available on all tiers
  const canAttachPhotos = true;
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
        className="sm:max-w-2xl max-h-[92vh] overflow-y-auto [&>button]:w-16 [&>button]:h-16 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-2xl [&>button]:bg-white/10 [&>button>svg]:!w-10 [&>button>svg]:!h-10 [&>button]:active:scale-75 [&>button]:transition-transform"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit log entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="edit-log-title" className="text-xl font-semibold">Title *</Label>
            <Input
              id="edit-log-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-16 !text-[22px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xl font-semibold">Site *</Label>
            <Select
              value={siteId}
              onValueChange={(v) => setSiteId(v as Id<"sites">)}
            >
              <SelectTrigger className="!h-[3.8rem] !text-[24px]">
                <SelectValue placeholder="Select a site" />
              </SelectTrigger>
              <SelectContent>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s._id} value={s._id} className="!text-[20px] py-4">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xl font-semibold">Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as LogCategory)}>
                <SelectTrigger className="!h-[3.8rem] !text-[24px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="!text-[20px] py-4">
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-log-date" className="text-xl font-semibold">Date & Time *</Label>
              <Input
                id="edit-log-date"
                type="datetime-local"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                className="h-16 !text-[20px]"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xl font-semibold">Location</Label>
            <LocationPicker
              value={location}
              onChange={setLocation}
              onCoordsChange={setCoords}
              initialCoords={coords}
              showMapByDefault={false}
              placeholder="e.g. Tower 12 – Roof East, 123 Main St"
              inputClassName="!h-14"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-log-content" className="text-xl font-semibold">Notes *</Label>
            <Textarea
              id="edit-log-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              style={{ fontFamily: "'MS Reference Sans Serif', sans-serif" }}
              className="!text-[18px] min-h-[180px] resize-none"
              required
            />
          </div>

          {/* Photos — available on all tiers */}
          <div className="space-y-2">
            <Label className="text-xl font-semibold flex items-center gap-2">
              Photos
            </Label>
            <PhotoUploader
              photos={photos}
              onChange={handlePhotosChange}
              maxPhotos={maxPhotosPerEntry}
            />
          </div>

          <DialogFooter className="gap-5 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose} className="h-16 text-xl px-8 rounded-2xl">
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-16 text-xl px-8 rounded-2xl"
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
