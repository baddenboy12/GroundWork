import { useState, useEffect, useCallback } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useOnlineStatus } from "./use-online-status.ts";

const QUEUE_KEY = "logvault_offline_queue_v1";
const QUEUE_CHANGED = "logvault_queue_changed";

/** A photo stored locally as a compressed base64 JPEG, waiting to be uploaded */
export type OfflinePhoto = {
  dataUrl: string;   // base64 data URL (compressed JPEG)
  fileName: string;
  bytes: number;     // approximate binary size
};

export type OfflineEntry = {
  id: string;
  siteName: string;
  siteLocation?: string;
  siteLat?: number;
  siteLng?: number;
  title: string;
  content: string;
  category: string;
  loggedAt: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  photos?: OfflinePhoto[];
  queuedAt: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a base64 data URL to a Blob for uploading */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

// ─── Pure queue utilities (safe outside React) ────────────────────────────────

export function getOfflineQueue(): OfflineEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineEntry[]) : [];
  } catch {
    return [];
  }
}

function setOfflineQueue(entries: OfflineEntry[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(QUEUE_CHANGED));
}

/** Add an entry to the offline queue. Returns the generated local ID. */
export function enqueueOfflineEntry(
  entry: Omit<OfflineEntry, "id" | "queuedAt">
): string {
  const id = crypto.randomUUID();
  setOfflineQueue([...getOfflineQueue(), { ...entry, id, queuedAt: Date.now() }]);
  return id;
}

// ─── Reactive hook — returns current queue, refreshes on changes ──────────────

export function useOfflineQueueState(): OfflineEntry[] {
  const [queue, setQueue] = useState<OfflineEntry[]>(getOfflineQueue);

  useEffect(() => {
    const refresh = () => setQueue(getOfflineQueue());
    window.addEventListener(QUEUE_CHANGED, refresh);
    return () => window.removeEventListener(QUEUE_CHANGED, refresh);
  }, []);

  return queue;
}

// ─── Sync hook — must be called inside an Authenticated context ───────────────

/**
 * Syncs all queued offline entries to Convex when the device comes back online.
 * Photos stored as base64 are uploaded to R2 before the log entry is created.
 */
export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const createLog = useMutation(api.logs.create);
  const findOrCreateSite = useMutation(api.sites.findOrCreate);
  const getUploadUrl = useAction(api.r2.storageActions.getUploadUrl);

  const syncQueue = useCallback(async () => {
    const pending = getOfflineQueue();
    if (pending.length === 0 || !navigator.onLine) return;

    setIsSyncing(true);
    const failed: OfflineEntry[] = [];
    let synced = 0;

    for (const entry of pending) {
      try {
        const siteId = await findOrCreateSite({
          name: entry.siteName,
          location: entry.siteLocation,
          latitude: entry.siteLat,
          longitude: entry.siteLng,
        });

        // Upload any locally-stored photos to R2 before creating the log
        const uploadedPhotos: { url: string; key: string; bytes: number }[] = [];
        if (entry.photos && entry.photos.length > 0) {
          for (const photo of entry.photos) {
            try {
              const blob = dataUrlToBlob(photo.dataUrl);
              const { uploadUrl, key, publicUrl } = await getUploadUrl({
                fileName: photo.fileName,
                contentType: "image/jpeg",
                bytes: blob.size,
              });
              const res = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "image/jpeg" },
                body: blob,
              });
              if (res.ok) {
                uploadedPhotos.push({ url: publicUrl, key, bytes: blob.size });
              }
            } catch {
              // Best-effort: skip failed individual photos, still save the log
            }
          }
        }

        await createLog({
          siteId: siteId as Id<"sites">,
          title: entry.title,
          content: entry.content,
          category: entry.category as
            | "inspection"
            | "maintenance"
            | "incident"
            | "audit"
            | "general",
          loggedAt: entry.loggedAt,
          photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
          location: entry.location,
          latitude: entry.latitude,
          longitude: entry.longitude,
        });
        synced++;
      } catch {
        failed.push(entry);
      }
    }

    setOfflineQueue(failed);
    setIsSyncing(false);

    if (synced > 0) {
      toast.success(
        `Synced ${synced} offline ${synced === 1 ? "entry" : "entries"}`
      );
    }
    if (failed.length > 0) {
      toast.error(
        `${failed.length} ${failed.length === 1 ? "entry" : "entries"} failed to sync — will retry when online`
      );
    }
  }, [createLog, findOrCreateSite, getUploadUrl]);

  // Auto-sync whenever we come back online
  useEffect(() => {
    if (isOnline) {
      syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return { isSyncing, syncQueue, isOnline };
}
