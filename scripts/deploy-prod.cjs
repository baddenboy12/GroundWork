#!/usr/bin/env node
/* eslint-env node */
/**
 * Production Convex deploy guard.
 *
 * Refuses to deploy unless:
 *   - the current branch is `main`
 *   - the working tree is clean (no uncommitted modifications outside
 *     auto-generated paths)
 *   - HEAD is in sync with origin/main
 *   - the user types "deploy" at the confirmation prompt
 *
 * Run via: npm run deploy:prod
 *
 * For non-prod deploys (iterating on a feature branch against the dev
 * Convex deployment), use plain `npx convex dev --once` — that path is
 * intentionally not guarded.
 */
const { spawnSync } = require("node:child_process");
const { requireCleanMain, confirmOrExit, fail } = require("./_deploy-guard.cjs");

(async () => {
  const { head } = requireCleanMain();

  console.log("\n──────────────────────────────────────────────");
  console.log("  PRODUCTION CONVEX DEPLOY");
  console.log(`  Branch: main (clean, in sync with origin)`);
  console.log(`  HEAD:   ${head}`);
  console.log("──────────────────────────────────────────────");

  await confirmOrExit('\nType "deploy" to push to the production Convex deployment: ');

  console.log("\n→ Running `npx convex deploy --yes`…\n");
  const result = spawnSync("npx", ["convex", "deploy", "--yes"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) fail(`Convex deploy failed (exit ${result.status}).`);
  console.log("\n✔ Convex prod deployed.\n");
})();
