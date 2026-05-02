#!/usr/bin/env node
/* eslint-env node */
/**
 * Combined production deploy: Convex backend + web frontend.
 *
 * Runs the same safety checks as deploy-prod / deploy-web-prod (branch=main,
 * clean tree, in sync with origin), prompts ONCE for confirmation, then
 * deploys backend first and frontend second.
 *
 * Order matters: backend before frontend. The backend can serve both the
 * old and new frontend during the brief window between deploys, so a
 * partially-deployed state stays usable. The reverse order risks the new
 * frontend hitting a backend that doesn't yet have the schema/functions
 * it expects.
 *
 * Run via: npm run deploy:all:prod
 *
 * If either step fails, the script exits and you can re-run after fixing.
 * (The Convex deploy is idempotent; SCP is too.)
 */
const { spawnSync } = require("node:child_process");
const { requireCleanMain, confirmOrExit, fail } = require("./_deploy-guard.cjs");

(async () => {
  const { head } = requireCleanMain();

  console.log("\n──────────────────────────────────────────────");
  console.log("  PRODUCTION DEPLOY — Convex + Web frontend");
  console.log(`  Branch: main (clean, in sync with origin)`);
  console.log(`  HEAD:   ${head}`);
  console.log("──────────────────────────────────────────────");
  console.log("  Order: 1) Convex backend  2) VPS frontend");
  console.log("──────────────────────────────────────────────");

  await confirmOrExit('\nType "deploy" to ship to production: ');

  const isWindows = process.platform === "win32";

  // 1. Convex backend
  console.log("\n[1/2] → Running `npx convex deploy --yes`…\n");
  const convex = spawnSync("npx", ["convex", "deploy", "--yes"], {
    stdio: "inherit",
    shell: isWindows,
  });
  if (convex.status !== 0) fail(`Convex deploy failed (exit ${convex.status}).`);

  // 2. Web build + SCP
  console.log("\n[2/2] → Running `npm run build`…\n");
  const build = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    shell: isWindows,
  });
  if (build.status !== 0) fail(`Build failed (exit ${build.status}).`);

  console.log("\n      → SCPing dist/* to /opt/groundwork/dist/…\n");
  const scp = spawnSync(
    "scp",
    ["-r", "dist/*", "root@172.233.163.131:/opt/groundwork/dist/"],
    { stdio: "inherit", shell: true }
  );
  if (scp.status !== 0) fail(`SCP failed (exit ${scp.status}).`);

  console.log("\n✔ Production deploy complete (Convex + web).\n");
})();
