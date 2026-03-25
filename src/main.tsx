import { createRoot } from "react-dom/client";
// Validate environment variables before anything else renders
import "@/lib/env.ts";
import { installGlobalErrorHandlers } from "@/lib/error-reporter.ts";
import App from "./App.tsx";

// Catch unhandled errors and promise rejections globally
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);

// Hide the HTML splash loader once React has mounted
const splash = document.getElementById("splash-loader");
if (splash) {
  splash.style.transition = "opacity 0.3s ease";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 300);
}
