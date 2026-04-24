import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";

/** Shape matches the return value of api.stripe.actions.previewSubscriptionSeats */
export type ProrationPreview = {
  immediateChargeCents: number;
  nextInvoiceTotalCents: number;
  nextInvoiceDate: string | null;
  currency: string;
};

type Props = {
  open: boolean;
  /** null while the preview is still being fetched — shows a spinner */
  preview: ProrationPreview | null;
  /** Whether the underlying action is in flight (after confirm) */
  isApplying: boolean;
  /** Label for the primary button — e.g. "Create Team" or "Update Seats" */
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "next renewal";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "next renewal";
  }
}

export default function ProrationConfirmDialog({
  open,
  preview,
  isApplying,
  actionLabel,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isApplying && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Review charges</DialogTitle>
          <DialogDescription>
            Here's what will be charged to your card on file before we apply
            this change.
          </DialogDescription>
        </DialogHeader>

        {preview === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground">Charged today (prorated)</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatAmount(preview.immediateChargeCents, preview.currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground">
                Starting {formatDate(preview.nextInvoiceDate)}
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatAmount(preview.nextInvoiceTotalCents, preview.currency)}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}/ month
                </span>
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={preview === null || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Applying…
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
