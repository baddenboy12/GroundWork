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
import LocationPicker from "./LocationPicker.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateSiteDialog({ open, onClose }: Props) {
  const createSite = useMutation(api.sites.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createSite({
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
      });
      toast.success("Site created");
      setName("");
      setDescription("");
      setLocation("");
      onClose();
    } catch {
      toast.error("Failed to create site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
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
              placeholder="123 Main St, City"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-desc">Description</Label>
            <Textarea
              id="site-desc"
              placeholder="Brief description of this site..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
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
