---
name: GroundWork tech stack
description: React 19 + Vite 7 + Convex backend + Tailwind 4 + shadcn/ui + Keycloak OIDC auth + R2 storage + PayPal billing
type: project
---

**Frontend**: React 19, Vite 7, TypeScript 5.9, React Router DOM 7, Tailwind CSS 4 (via @tailwindcss/vite plugin), shadcn/ui (Radix primitives + CVA), Motion (framer-motion successor), Recharts for charts, Leaflet/react-leaflet for maps, react-hook-form + zod for forms, sonner for toasts, cmdk for command palette, next-themes for dark mode.

**Backend**: Convex (serverless DB + real-time queries/mutations + scheduled functions). Schema in convex/schema.ts. HTTP routes in convex/http.ts expose a REST API at /api/v1/*.

**Auth**: Keycloak via OIDC (oidc-client-ts + react-oidc-context + Convex auth integration). Auth config references KEYCLOAK_OIDC_AUTHORITY and KEYCLOAK_OIDC_CLIENT_ID env vars.

**Storage**: Cloudflare R2 for photo storage (via @aws-sdk/client-s3 + presigned URLs). Legacy Convex built-in storage still supported. Photo proxy endpoint in http.ts for CORS.

**Billing**: PayPal subscriptions with webhook processing. Tiers: free, starter, pro, business. License keys for team management.

**Package manager**: pnpm (pnpm-workspace.yaml present).

**Path aliases**: `@/` → `./src/`, `@/convex/` → `./convex/`

**Why:** Understanding the stack prevents suggesting incompatible libraries or patterns.

**How to apply:** Use Convex patterns (queries/mutations/actions, not raw SQL). Use shadcn/ui components from src/components/ui/. Use pnpm, not npm/yarn.
