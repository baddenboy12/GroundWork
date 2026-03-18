import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
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

type LogWithAuthor = Doc<"logs"> & { authorName: string; photoUrls: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  log: LogWithAuthor;
};

export default function EditLogDialog({ open, onClose, log }: Props) {
  const updateLog = useMutation(api.logs.update);
  const sites = useQuery(api.sites.list, {});
  const isOnline = useOnlineStatus();

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
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    // Reset to original values on cancel
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
    try {
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
        // Preserve existing R2 photos (photo editing not supported in this dialog)
        photos: log.photos,
      });
      toast.success("Log entry updated");
      onClose();
    } catch {
      toast.error("Failed to update log entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit log entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-2xl">
          <div className="space-y-1.5">
            <Label htmlFor="edit-log-title">Title *</Label>
            <Input
              id="edit-log-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Site *</Label>
            <Select
              value={siteId}
              onValueChange={(v) => setSiteId(v as Id<"sites">)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a site" />
              </SelectTrigger>
              <SelectContent>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Label htmlFor="edit-log-date">Date & Time *</Label>
              <Input
                id="edit-log-date"
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
              initialCoords={coords}
              placeholder="e.g. Tower 12 – Roof East, 123 Main St"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-log-content">Notes *</Label>
            <Textarea
              id="edit-log-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="text-2xl"
              required
            />
          </div>

          {log.photoUrls.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Attached photos ({log.photoUrls.length}) — to change photos, delete and recreate this entry
              </Label>
              <div className="flex gap-2 flex-wrap">
                {log.photoUrls.map((url, i) => (
                  <img
                    key={url}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                  />
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || !content.trim() || !isOnline}
            >
              {loading ? "Saving..." : !isOnline ? "Offline" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
