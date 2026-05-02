/* eslint-env node */
/**
 * Shared "main, clean, in sync with origin" preflight check used by all
 * production deploy scripts (deploy-prod, deploy-web-prod, deploy-all-prod).
 *
 * Exported helpers:
 *   - requireCleanMain(): runs all checks, exits 1 with a clear message if
 *     anything fails. Returns { branch, head, headHash, headSubject }.
 *   - confirmOrExit(label, prompt): readline confirmation gate.
 */
const { execSync } = require("node:child_process");
const readline = require("node:readline");

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function requireCleanMain() {
  // 1. Branch
  const branch = sh("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    fail(
      `Refusing to deploy to prod from branch "${branch}". Switch to main first.`
    );
  }

  // 2. Clean tree (ignore untracked + auto-generated)
  const rawStatus = execSync("git status --porcelain", { encoding: "utf8" });
  const status = rawStatus
    .split("\n")
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("??")) return false;
      const path = line.slice(3);
      if (path.startsWith("convex/_generated/")) return false;
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
  const [behind, ahead] = sh("git rev-list --left-right --count origin/main...HEAD")
    .split(/\s+/)
    .map((n) => parseInt(n, 10));
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

  const headHash = sh("git rev-parse --short HEAD");
  const headSubject = sh("git log -1 --pretty=format:%s HEAD");
  return { branch, headHash, headSubject, head: `${headHash} ${headSubject}` };
}

function confirmOrExit(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      if (answer.trim() !== "deploy") {
        console.log("\nAborted.\n");
        process.exit(1);
      }
      resolve();
    });
  });
}

module.exports = { requireCleanMain, confirmOrExit, fail };
