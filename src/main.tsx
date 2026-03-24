import { createRoot } from "react-dom/client";
// Validate environment variables before anything else renders
import "@/lib/env.ts";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
