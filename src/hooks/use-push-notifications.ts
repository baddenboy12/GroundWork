import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isNative } from "@/lib/platform";

/**
 * Registers for push notifications on native Capacitor.
 * On web, this is a no-op (web push can be added later).
 *
 * Call this hook once in the authenticated app shell.
 */
export function usePushNotifications() {
  const registerToken = useMutation(api.pushTokens.register);
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isNative || registeredRef.current) return;
    registeredRef.current = true;

    (async () => {
      try {
        const { PushNotifications } =
          await import("@capacitor/push-notifications");

        // Request permission
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") {
          console.warn("[Push] Permission not granted:", permResult.receive);
          return;
        }

        // Register with FCM
        await PushNotifications.register();

        // Listen for the FCM token
        PushNotifications.addListener("registration", async (token) => {
          if (import.meta.env.DEV) {
            console.debug("[Push] FCM token registered");
          }
          await registerToken({ token: token.value, platform: "android" });
        });

        PushNotifications.addListener("registrationError", (error) => {
          console.error("[Push] Registration error:", error);
        });

        // Handle foreground notifications
        PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            if (import.meta.env.DEV) {
              console.debug("[Push] Foreground notification:", notification);
            }
            // Could show a toast or in-app notification here
          },
        );

        // Handle notification tap (app was in background)
        PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            if (import.meta.env.DEV) {
              console.debug("[Push] Notification tapped:", action);
            }
            // Could navigate to a specific page based on action.notification.data
          },
        );
      } catch (err) {
        console.error("[Push] Setup error:", err);
      }
    })();
  }, [registerToken]);
}
