import { createRoot } from "react-dom/client";
// Validate environment variables before anything else renders
import "@/lib/env.ts";
import { installGlobalErrorHandlers } from "@/lib/error-reporter.ts";
import App from "./App.tsx";

// Catch unhandled errors and promise rejections globally
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
