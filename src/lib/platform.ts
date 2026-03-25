import { Capacitor } from "@capacitor/core";

/** True when running inside a Capacitor native shell (Android/iOS). */
export const isNative = Capacitor.isNativePlatform();

/** True when running as a PWA in the browser (not in Capacitor). */
export const isWeb = !isNative;

/** Returns "android" | "ios" | "web" */
export const platform = Capacitor.getPlatform() as "android" | "ios" | "web";
