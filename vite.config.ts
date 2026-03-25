import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/convex": path.resolve(__dirname, "./convex"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate cacheable chunks
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-convex": ["convex", "convex/react"],
          "vendor-ui": ["motion/react", "sonner", "lucide-react"],
          "vendor-maps": ["leaflet", "react-leaflet"],
          "vendor-export": ["exceljs"],
          "vendor-oidc": ["oidc-client-ts", "react-oidc-context"],
        },
      },
    },
  },
});
