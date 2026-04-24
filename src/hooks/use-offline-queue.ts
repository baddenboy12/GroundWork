import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useOnlineStatus } from "./use-online-status.ts";
import { CONFIG } from "@/lib/config.ts";

const QUEUE_KEY = CONFIG.OFFLINE_QUEUE_KEY;
const QUEUE_CHANGED = CONFIG.OFFLINE_QUEUE_EVENT;

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
  // Convex is only usable for mutations once its WebSocket is authenticated.
  // On reconnect after a long offline period, the id_token may have expired;
  // Convex silently refreshes it via signinSilent() but mutations fired before
  // that completes throw UNAUTHENTICATED. Gate sync on this flag so we don't
  // burn the queue against a half-ready client.
  const { isAuthenticated: isConvexAuthed } = useConvexAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  // Ref-based guard prevents concurrent sync calls from processing the same
  // queue entries twice. This avoids duplicate log creation when:
  //   1. The app opens with navigator.onLine=true (unreliable) → sync starts
  //   2. The real probe later detects online → a second sync is triggered
  //   3. Both calls read the queue before either removes the entry
  const syncingRef = useRef(false);

  const createLog = useMutation(api.logs.create);
  const findOrCreateSite = useMutation(api.sites.findOrCreate);
  const getUploadUrl = useAction(api.r2.storageActions.getUploadUrl);

  const syncQueue = useCallback(async () => {
    // Hard guard — bail immediately if a sync is already in flight
    if (syncingRef.current) return;
    const pending = getOfflineQueue();
    if (pending.length === 0) return;
    // Use the probed isOnline value (not navigator.onLine which is unreliable
    // on 4G with no data) so we don't attempt sync on a dead connection.
    if (!isOnline) {
      toast.error("Still offline — can't sync yet");
      return;
    }
    // Convex WebSocket may be up but not yet authenticated (token refresh
    // in flight after coming back online). Firing mutations here would
    // throw UNAUTHENTICATED and discard the queue silently. Surface a
    // clear message and let the auto-sync retry once auth settles.
    if (!isConvexAuthed) {
      toast.error("Reconnecting — try Sync now in a moment");
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);
    const failed: OfflineEntry[] = [];
    const errors: string[] = [];
    let synced = 0;

    try {
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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[offline-sync] entry ${entry.id} failed:`, msg);
          errors.push(msg);
          failed.push(entry);
        }
      }

      setOfflineQueue(failed);

      if (synced > 0) {
        toast.success(
          `Synced ${synced} offline ${synced === 1 ? "entry" : "entries"}`
        );
      }
      if (failed.length > 0) {
        // Surface the first error so the user can see why sync stalled
        // (auth expired, site limit hit, payment suspended, etc.) instead
        // of a generic "will retry" message that loops forever.
        const firstError = errors[0] ?? "unknown error";
        toast.error(
          `${failed.length} ${failed.length === 1 ? "entry" : "entries"} failed — ${firstError}`
        );
      }
    } finally {
      // Always release the lock so future syncs can proceed
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [createLog, findOrCreateSite, getUploadUrl, isOnline, isConvexAuthed]);

  // Auto-sync whenever we come back online AND Convex auth is ready
  useEffect(() => {
    if (isOnline && isConvexAuthed) {
      syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isConvexAuthed]);

  return { isSyncing, syncQueue, isOnline };
}
