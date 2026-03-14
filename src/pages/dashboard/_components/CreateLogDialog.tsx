import { useState } from "react";
import { useMutation } from "convex/react";
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
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { LOG_CATEGORIES, CATEGORY_LABELS, type LogCategory } from "../_lib/constants.ts";
import PhotoUploader from "./PhotoUploader.tsx";
import UpgradeDialog from "./UpgradeDialog.tsx";
import { useSubscription } from "@/hooks/use-subscription.ts";
import { Lock } from "lucide-react";

type UploadedPhoto = {
  storageId: Id<"_storage">;
  previewUrl: string;
  fileName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: Id<"sites">;
};

export default function CreateLogDialog({ open, onClose, siteId }: Props) {
  const createLog = useMutation(api.logs.create);
  const { isAtLeast } = useSubscription();
  const canAttachPhotos = isAtLeast("starter");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<LogCategory>("general");
  const [loggedAt, setLoggedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoUpgradeOpen, setPhotoUpgradeOpen] = useState(false);

  const handleClose = () => {
    setTitle("");
    setContent("");
    setCategory("general");
    setLoggedAt(new Date().toISOString().slice(0, 16));
    setPhotos([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    try {
      await createLog({
        siteId,
        title: title.trim(),
        content: content.trim(),
        category,
        loggedAt: new Date(loggedAt).toISOString(),
        photoStorageIds: photos.length > 0 ? photos.map((p) => p.storageId) : undefined,
      });
      toast.success("Log entry created");
      handleClose();
    } catch {
      toast.error("Failed to create log entry");
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

            {/* Photos — gated behind Starter plan */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                Photos
                {!canAttachPhotos && (
                  <span className="text-[10px] font-normal text-muted-foreground border border-border rounded-full px-1.5 py-0.5 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Starter+
                  </span>
                )}
              </Label>
              {canAttachPhotos ? (
                <PhotoUploader photos={photos} onChange={setPhotos} />
              ) : (
                <button
                  type="button"
                  onClick={() => setPhotoUpgradeOpen(true)}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Lock className="w-5 h-5" />
                  <span className="text-sm font-medium">Photo attachments require Starter or higher</span>
                  <span className="text-xs">Click to upgrade</span>
                </button>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !title.trim() || !content.trim()}>
                {loading ? "Saving..." : "Save entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={photoUpgradeOpen}
        onClose={() => setPhotoUpgradeOpen(false)}
        requiredTier="starter"
        featureName="Photo attachments"
        featureDescription="Attach photos to log entries on the Starter plan and above."
      />
    </>
  );
}
