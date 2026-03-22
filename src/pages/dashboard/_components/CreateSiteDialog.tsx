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
      <DialogContent className="!max-w-none w-[90%] p-10 top-[8%] translate-y-0 overflow-y-auto max-h-[90vh] rounded-3xl [&>button]:w-20 [&>button]:h-20 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-2xl [&>button]:bg-white/10 [&>button>svg]:!w-14 [&>button>svg]:!h-14 [&>button]:active:scale-75 [&>button]:transition-transform" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-5xl font-bold">Create new site</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-10 pt-6">
          <div className="space-y-4">
            <Label htmlFor="site-name" className="text-3xl">Site name *</Label>
            <Input
              id="site-name"
              placeholder="Tower Site Alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-[5rem] rounded-2xl px-6 !text-[26px]"
            />
          </div>
          <div className="space-y-4">
            <Label htmlFor="site-location" className="text-3xl">Location</Label>
            <LocationPicker
              id="site-location"
              value={location}
              onChange={setLocation}
              onCoordsChange={setCoords}
              placeholder="123 Main St, City"
            />
          </div>
          <DialogFooter className="gap-5 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="h-20 text-2xl px-10 rounded-2xl">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="h-20 text-2xl px-10 rounded-2xl">
              {loading ? "Creating..." : "Create site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
