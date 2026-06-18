import { useEffect, useRef } from "react";
import { isNative } from "@/lib/platform.ts";

type BackButtonEvent = {
  canGoBack: boolean;
};

type BackButtonHandle = {
  remove: () => Promise<void>;
};

export function useNativeBackButton(
  onBack: (event: BackButtonEvent) => boolean | void,
) {
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!isNative) return;

    let handle: BackButtonHandle | null = null;
    let cancelled = false;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("backButton", (event) => {
        onBackRef.current({ canGoBack: event.canGoBack });
      });
      if (cancelled) {
        void listener.remove();
      } else {
        handle = listener;
      }
    })();

    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, []);
}
