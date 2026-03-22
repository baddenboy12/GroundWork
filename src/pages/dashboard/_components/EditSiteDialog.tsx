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
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import LocationPicker, { type PickerCoords } from "./LocationPicker.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
  site: Doc<"sites">;
};

export default function EditSiteDialog({ open, onClose, site }: Props) {
  const updateSite = useMutation(api.sites.update);
  const [name, setName] = useState(site.name);
  const [location, setLocation] = useState(site.location ?? "");
  // Initialise coords from stored values so the map opens pre-pinned
  const [coords, setCoords] = useState<PickerCoords | null>(
    site.latitude != null && site.longitude != null
      ? { lat: site.latitude, lng: site.longitude }
      : null
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateSite({
        siteId: site._id,
        name: name.trim(),
        description: undefined,
        location: location.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      toast.success("Site updated");
      onClose();
    } catch {
      toast.error("Failed to update site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit site</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-site-name">Site name *</Label>
            <Input
              id="edit-site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Renaming this site updates the label across all log entries under it.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-site-location">Location</Label>
            <LocationPicker
              id="edit-site-location"
              value={location}
              onChange={setLocation}
              onCoordsChange={setCoords}
              initialCoords={coords}
              placeholder="123 Main St, City"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
