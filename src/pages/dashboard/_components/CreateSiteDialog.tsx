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
import LocationPicker, { type PickerCoords } from "./LocationPicker.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateSiteDialog({ open, onClose }: Props) {
  const createSite = useMutation(api.sites.create);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<PickerCoords | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createSite({
        name: name.trim(),
        description: undefined,
        location: location.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
      });
      toast.success("Site created");
      setName("");
      setLocation("");
      setCoords(null);
      onClose();
    } catch {
      toast.error("Failed to create site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md top-[15%] translate-y-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create new site</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="site-name">Site name *</Label>
            <Input
              id="site-name"
              placeholder="Tower Site Alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-location">Location</Label>
            <LocationPicker
              id="site-location"
              value={location}
              onChange={setLocation}
              onCoordsChange={setCoords}
              placeholder="123 Main St, City"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
