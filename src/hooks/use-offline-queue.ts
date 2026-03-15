import { useState, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useOnlineStatus } from "./use-online-status.ts";

const QUEUE_KEY = "logvault_offline_queue_v1";
const QUEUE_CHANGED = "logvault_queue_changed";

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
  queuedAt: number;
};

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
 * Call this once from a component that is always mounted while authenticated
 * (e.g. DashboardInner).
 */
export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const createLog = useMutation(api.logs.create);
  const findOrCreateSite = useMutation(api.sites.findOrCreate);

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
  }, [createLog, findOrCreateSite]);

  // Auto-sync whenever we come back online
  useEffect(() => {
    if (isOnline) {
      syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return { isSyncing, syncQueue, isOnline };
}
