#!/usr/bin/env node
/* eslint-env node */
/**
 * Cross-platform APK builder.
 *
 * Usage:
 *   node scripts/build-apk.cjs dev      # build dev-backend APK (Convex dev, R2 dev, test Stripe)
 *   node scripts/build-apk.cjs release  # build prod APK (Play Store)
 *
 * Both produce a release-signed APK; the difference is which Convex / Stripe /
 * R2 environment is baked into the bundled web assets via Vite mode flags.
 *
 * (Capacitor's plugin libraries publish only the `release` Android variant
 *  via `publishing { singleVariant("release") }`, so `gradlew assembleDebug`
 *  is not viable in this codebase. We always assembleRelease and rely on the
 *  Vite-mode-aware `npm run build:dev` to switch backend URLs.)
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const mode = process.argv[2];
if (mode !== "dev" && mode !== "release") {
  console.error('Usage: node scripts/build-apk.cjs (dev|release)');
  process.exit(1);
}

const isWindows = process.platform === "win32";

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}\n`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: isWindows,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const buildScript = mode === "dev" ? "build:dev" : "build";
run("npm", ["run", buildScript]);
run("npx", ["cap", "sync", "android"]);

// On Windows cmd, CWD is not in PATH by default — use explicit relative path.
const gradleCmd = isWindows ? ".\\gradlew.bat" : "./gradlew";
run(gradleCmd, ["assembleRelease"], {
  cwd: path.join(process.cwd(), "android"),
});

console.log(`\n✔ ${mode === "dev" ? "Dev" : "Release"} APK built. Output:`);
console.log(`  android/app/build/outputs/apk/release/app-release.apk\n`);
