import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { AlertTriangle, Trash2, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import Navbar from "./Navbar.tsx";
import Footer from "./Footer.tsx";

export default function AccountDeletionPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-6">
          {authLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : isAuthenticated ? (
            <AuthenticatedDeletion />
          ) : (
            <UnauthenticatedInfo />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Shown when user is NOT signed in — informational only */
function UnauthenticatedInfo() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Delete Your Account</h1>
      <p className="text-muted-foreground text-lg">
        To delete your GroundWork account and all associated data, please sign in first.
        Once signed in, you'll be able to confirm deletion directly from this page.
      </p>
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">What gets deleted</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            Your user profile (name, email)
          </li>
          <li className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            All log entries you created
          </li>
          <li className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            All photos attached to your logs
          </li>
          <li className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            All personal sites you own
          </li>
          <li className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            Team membership and any team data if you are the last member
          </li>
          <li className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            Active subscriptions (cancelled automatically)
          </li>
        </ul>
        <p className="text-sm text-muted-foreground/70">
          This action is permanent and cannot be undone.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Alternatively, you can email{" "}
        <a href="mailto:groundwork@teezfpo.com" className="text-primary hover:underline">
          groundwork@teezfpo.com
        </a>{" "}
        to request account deletion.
      </p>
    </div>
  );
}

/** Shown when user IS signed in — actual delete flow */
function AuthenticatedDeletion() {
  const user = useQuery(api.users.getCurrentUser, {});
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="space-y-6 text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <h1 className="text-3xl font-bold text-foreground">Account Deleted</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Your account and all associated data have been permanently deleted.
          You will be signed out shortly.
        </p>
      </div>
    );
  }

  const isConfirmed = confirmText.toLowerCase() === "delete my account";

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
      setDeleted(true);
      // Sign out after a short delay so the user sees the confirmation
      setTimeout(() => {
        // Clear all local storage and redirect
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k) localStorage.removeItem(k);
        }
        sessionStorage.clear();
        window.location.replace("/");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <a
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </a>

      <h1 className="text-3xl font-bold text-foreground">Delete Your Account</h1>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">This action is permanent</h2>
            <p className="text-muted-foreground mt-1">
              Deleting your account will permanently remove all of the following:
            </p>
          </div>
        </div>

        <ul className="space-y-2 text-muted-foreground ml-9">
          <li>Your user profile ({user.name ?? "unnamed"}, {user.email ?? "no email"})</li>
          <li>All log entries and attached photos</li>
          <li>All personal sites you own</li>
          <li>Team membership and shared team data (if you are the last member)</li>
          <li>Active subscriptions (cancelled automatically)</li>
        </ul>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Type <span className="font-mono text-destructive">delete my account</span> to confirm
        </label>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="delete my account"
          className="h-12 text-base"
          disabled={deleting}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        variant="destructive"
        size="lg"
        className="w-full h-12 text-base"
        disabled={!isConfirmed || deleting}
        onClick={handleDelete}
      >
        {deleting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Deleting account…
          </>
        ) : (
          <>
            <Trash2 className="w-4 h-4 mr-2" />
            Permanently delete my account
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        After deletion, you will be signed out and redirected to the home page.
      </p>
    </div>
  );
}
