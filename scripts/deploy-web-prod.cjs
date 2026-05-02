#!/usr/bin/env node
/* eslint-env node */
/**
 * Production web frontend deploy guard.
 *
 * Builds the prod-mode bundle and SCPs it to /opt/groundwork/dist/ on the
 * VPS — the path nginx serves at https://groundwork.teezfpo.com.
 *
 * Refuses to deploy unless:
 *   - the current branch is `main`
 *   - the working tree is clean (no uncommitted modifications outside
 *     auto-generated paths)
 *   - HEAD is in sync with origin/main (not behind, not ahead unpushed)
 *   - the user types "deploy" at the confirmation prompt
 *
 * Run via: npm run deploy:web:prod
 *
 * For staging/dev frontend deploys (any branch, any tree state), use
 * `npm run deploy:dev` — that path is intentionally not guarded.
 *
 * NOTE: This script mirrors scripts/deploy-prod.cjs but ships the web
 * frontend instead of the Convex backend. They both gate on the same
 * "main, clean, in sync" invariants so that production code always
 * matches what's on GitHub.
 */
const { execSync, spawnSync } = require("node:child_process");
const readline = require("node:readline");

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// 1. Branch check
const branch = sh("git rev-parse --abbrev-ref HEAD");
if (branch !== "main") {
  fail(
    `Refusing to deploy to prod from branch "${branch}". Switch to main first.`
  );
}

// 2. Clean tree check (same exclusions as deploy-prod.cjs)
const rawStatus = execSync("git status --porcelain", { encoding: "utf8" });
const status = rawStatus
  .split("\n")
  .filter((line) => {
    if (!line) return false;
    if (line.startsWith("??")) return false; // untracked
    const path = line.slice(3);
    if (path.startsWith("convex/_generated/")) return false; // auto-regenerated
    return true;
  })
  .join("\n");
if (status) {
  fail(`Refusing to deploy to prod with uncommitted changes:\n${status}`);
}

// 3. Sync with origin
try {
  sh("git fetch origin main");
} catch {
  fail("Could not fetch origin/main. Check your network and try again.");
}
const aheadBehind = sh("git rev-list --left-right --count origin/main...HEAD")
  .split(/\s+/)
  .map((n) => parseInt(n, 10));
const [behind, ahead] = aheadBehind;
if (behind > 0) {
  fail(
    `Refusing to deploy: local main is ${behind} commit(s) behind origin/main. Pull first.`
  );
}
if (ahead > 0) {
  fail(
    `Refusing to deploy: local main has ${ahead} unpushed commit(s). Push first so the deploy matches what's on GitHub.`
  );
}

// 4. Confirmation prompt
const headHash = sh("git rev-parse --short HEAD");
const headSubject = sh("git log -1 --pretty=format:%s HEAD");
const head = `${headHash} ${headSubject}`;
console.log("\n──────────────────────────────────────────────");
console.log("  PRODUCTION WEB FRONTEND DEPLOY");
console.log(`  Target: https://groundwork.teezfpo.com`);
console.log(`  Branch: main (clean, in sync with origin)`);
console.log(`  HEAD:   ${head}`);
console.log("──────────────────────────────────────────────");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  '\nType "deploy" to build and SCP to the production VPS: ',
  (answer) => {
    rl.close();
    if (answer.trim() !== "deploy") {
      console.log("\nAborted.\n");
      process.exit(1);
    }

    const isWindows = process.platform === "win32";

    console.log("\n→ Running `npm run build`…\n");
    const build = spawnSync("npm", ["run", "build"], {
      stdio: "inherit",
      shell: isWindows,
    });
    if (build.status !== 0) {
      fail(`Build failed (exit ${build.status}). Aborting deploy.`);
    }

    console.log("\n→ SCPing dist/* to /opt/groundwork/dist/ on VPS…\n");
    // dist/* is a glob; needs shell expansion. Use shell:true for both
    // platforms since scp itself doesn't expand globs.
    const scp = spawnSync(
      "scp",
      ["-r", "dist/*", "root@172.233.163.131:/opt/groundwork/dist/"],
      { stdio: "inherit", shell: true }
    );
    if (scp.status !== 0) {
      fail(`SCP failed (exit ${scp.status}).`);
    }

    console.log("\n✔ Production web frontend deployed.\n");
    process.exit(0);
  }
);
