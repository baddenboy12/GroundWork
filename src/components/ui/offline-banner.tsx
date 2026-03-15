import { WifiOff, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";

type Props = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSync: () => void;
};

export default function OfflineBanner({
  isOnline,
  pendingCount,
  isSyncing,
  onSync,
}: Props) {
  if (isOnline && pendingCount === 0) return null;

  const isOfflineWithPending = !isOnline && pendingCount > 0;
  const isOfflineNoPending = !isOnline && pendingCount === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 text-xs border-b shrink-0",
        !isOnline
          ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
          : "bg-primary/5 border-primary/20 text-primary"
      )}
    >
      {!isOnline ? (
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
      ) : isSyncing ? (
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
      ) : (
        <Clock className="w-3.5 h-3.5 shrink-0" />
      )}

      <span className="flex-1">
        {isOfflineNoPending &&
          "You're offline — entries will be saved locally and synced when you reconnect"}
        {isOfflineWithPending &&
          `You're offline — ${pendingCount} ${pendingCount === 1 ? "entry" : "entries"} queued for sync`}
        {isOnline && isSyncing &&
          `Syncing ${pendingCount} queued ${pendingCount === 1 ? "entry" : "entries"}…`}
        {isOnline && !isSyncing && pendingCount > 0 &&
          `${pendingCount} offline ${pendingCount === 1 ? "entry" : "entries"} ready to sync`}
      </span>

      {isOnline && pendingCount > 0 && !isSyncing && (
        <Button
          size="sm"
          variant="secondary"
          className="h-6 text-xs px-2.5 shrink-0"
          onClick={onSync}
        >
          Sync now
        </Button>
      )}
    </div>
  );
}
