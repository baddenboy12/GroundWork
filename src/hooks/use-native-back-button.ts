import { useEffect, useRef, type MutableRefObject } from "react";
import { isNative } from "@/lib/platform.ts";

type BackButtonEvent = {
  canGoBack: boolean;
};

type BackButtonHandle = {
  remove: () => Promise<void>;
};

type BackButtonOptions = {
  priority?: number;
};

type BackButtonEntry = {
  id: number;
  priority: number;
  ref: MutableRefObject<(event: BackButtonEvent) => boolean | void>;
};

let nextEntryId = 1;
let listenerUsers = 0;
let nativeListener: BackButtonHandle | null = null;
let nativeListenerPromise: Promise<void> | null = null;
const handlerEntries: BackButtonEntry[] = [];

function dispatchNativeBack(event: BackButtonEvent) {
  const orderedEntries = [...handlerEntries].sort(
    (a, b) => b.priority - a.priority || b.id - a.id,
  );
  for (const entry of orderedEntries) {
    if (entry.ref.current(event) === true) return;
  }
}

function ensureNativeListener() {
  if (nativeListener || nativeListenerPromise) return;

  nativeListenerPromise = (async () => {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("backButton", dispatchNativeBack);
    nativeListenerPromise = null;

    if (listenerUsers === 0) {
      void listener.remove();
      return;
    }

    nativeListener = listener;
  })();
}

function removeNativeListenerIfIdle() {
  if (listenerUsers > 0 || !nativeListener) return;
  const listener = nativeListener;
  nativeListener = null;
  void listener.remove();
}

export function useNativeBackButton(
  onBack: (event: BackButtonEvent) => boolean | void,
  options: BackButtonOptions = {},
) {
  const onBackRef = useRef(onBack);
  const priority = options.priority ?? 0;

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!isNative) return;

    const entry: BackButtonEntry = {
      id: nextEntryId++,
      priority,
      ref: onBackRef,
    };
    handlerEntries.push(entry);
    listenerUsers += 1;
    ensureNativeListener();

    return () => {
      const index = handlerEntries.indexOf(entry);
      if (index >= 0) handlerEntries.splice(index, 1);
      listenerUsers = Math.max(0, listenerUsers - 1);
      removeNativeListenerIfIdle();
    };
  }, [priority]);
}
