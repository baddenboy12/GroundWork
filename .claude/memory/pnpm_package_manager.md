---
name: GroundWork uses pnpm, not npm, for installs
description: Project's node_modules is pnpm-structured — npm install breaks with arborist dedup errors
type: reference
---

The project's `node_modules/` is pnpm-structured (`node_modules/.pnpm/...`) and the lockfile is `pnpm-lock.yaml`. `package-lock.json` does not exist.

**Install commands:** use `npx pnpm add <pkg>` or `npx pnpm install`. `npm install` crashes with `TypeError: Cannot read properties of null (reading 'matches')` at `Link.matches` in `@npmcli/arborist` because it cannot reconcile the pnpm-generated symlink layout.

**Script commands:** `npm run build` / `npm run dev` still work fine — those just execute scripts from `package.json` regardless of which installer created `node_modules/`. CLAUDE.md's quick-reference uses `npm run build` for this reason.

**pnpm isn't on PATH** on this machine — always invoke via `npx pnpm`. Corepack is installed (v0.34.5) but pnpm isn't enabled through it.
