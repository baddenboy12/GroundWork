import { Component, type ReactNode } from "react";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional fallback UI. If omitted, a branded error screen is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertCircleIcon className="size-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Your data is safe — try reloading
              the page.
            </p>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <pre className="w-full overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.handleGoHome}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Go Home
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCwIcon className="size-4" />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
