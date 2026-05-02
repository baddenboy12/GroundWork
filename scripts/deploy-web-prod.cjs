#!/usr/bin/env node
/* eslint-env node */
/**
 * Production web frontend deploy guard.
 *
 * Builds the prod-mode bundle and SCPs it to /opt/groundwork/dist/ on the
 * VPS — the path nginx serves at https://groundwork.teezfpo.com.
 *
 * Same gating rules as deploy-prod.cjs (branch=main, clean tree, in sync,
 * confirmation prompt).
 *
 * For staging/dev frontend deploys (any branch, any tree state), use
 * `npm run deploy:dev`.
 */
const { spawnSync } = require("node:child_process");
const { requireCleanMain, confirmOrExit, fail } = require("./_deploy-guard.cjs");

(async () => {
  const { head } = requireCleanMain();

  console.log("\n──────────────────────────────────────────────");
  console.log("  PRODUCTION WEB FRONTEND DEPLOY");
  console.log(`  Target: https://groundwork.teezfpo.com`);
  console.log(`  Branch: main (clean, in sync with origin)`);
  console.log(`  HEAD:   ${head}`);
  console.log("──────────────────────────────────────────────");

  await confirmOrExit('\nType "deploy" to build and SCP to the production VPS: ');

  const isWindows = process.platform === "win32";

  console.log("\n→ Running `npm run build`…\n");
  const build = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    shell: isWindows,
  });
  if (build.status !== 0) fail(`Build failed (exit ${build.status}).`);

  console.log("\n→ SCPing dist/* to /opt/groundwork/dist/…\n");
  const scp = spawnSync(
    "scp",
    ["-r", "dist/*", "root@172.233.163.131:/opt/groundwork/dist/"],
    { stdio: "inherit", shell: true }
  );
  if (scp.status !== 0) fail(`SCP failed (exit ${scp.status}).`);

  console.log("\n✔ Production web frontend deployed.\n");
})();
