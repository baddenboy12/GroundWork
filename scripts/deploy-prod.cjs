#!/usr/bin/env node
/* eslint-env node */
/**
 * Production Convex deploy guard.
 *
 * Refuses to deploy unless:
 *   - the current branch is `main`
 *   - the working tree is clean (no uncommitted modifications)
 *   - HEAD is in sync with origin/main (not behind, not ahead with unpushed commits)
 *   - the user types "deploy" at the confirmation prompt
 *
 * Run via: npm run deploy:prod
 *
 * For non-prod deploys (e.g. iterating on a feature branch against the dev
 * Convex deployment), use plain `npx convex deploy` — that path is
 * intentionally not guarded.
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

// 2. Clean tree check
const status = sh("git status --porcelain");
if (status) {
  fail(
    `Refusing to deploy to prod with a dirty working tree. Commit or stash first:\n${status}`
  );
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
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const head = sh("git log -1 --format=%h\\ %s HEAD");
console.log("\n──────────────────────────────────────────────");
console.log("  PRODUCTION CONVEX DEPLOY");
console.log(`  Branch: main (clean, in sync with origin)`);
console.log(`  HEAD:   ${head}`);
console.log("──────────────────────────────────────────────");

rl.question(
  '\nType "deploy" to push to the production Convex deployment: ',
  (answer) => {
    rl.close();
    if (answer.trim() !== "deploy") {
      console.log("\nAborted.\n");
      process.exit(1);
    }
    console.log("\n→ Running `npx convex deploy --yes`…\n");
    const result = spawnSync("npx", ["convex", "deploy", "--yes"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(result.status ?? 0);
  }
);
