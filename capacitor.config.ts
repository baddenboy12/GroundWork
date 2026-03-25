import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.teezfpo.groundwork",
  appName: "GroundWork",
  webDir: "dist",
  server: {
    // Use https scheme so localStorage keys from the PWA domain carry over
    androidScheme: "https",
    // Match the TWA hostname to preserve existing OIDC tokens in localStorage
    hostname: "groundwork.teezfpo.com",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
