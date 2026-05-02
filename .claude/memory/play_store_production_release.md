---
name: Play Store production release & upload key
description: Upload keystore location, fingerprint, versionCode history, and AAB build/upload checklist for Google Play production
type: project
---

## Upload Keystore (post-reset, Apr 2026)

- **Location**: `C:/Users/cyr/Downloads/groundwork-upload.keystore`
- **Alias**: `upload`
- **Owner**: `CN=GroundWork, O=GroundWork`
- **Valid**: Apr 24 2026 → Apr 18 2051
- **SHA1**: `A6:40:D1:D3:54:BD:C2:7D:E8:39:4D:42:AD:3A:2F:53:76:6D:94:7E`
- **MD5**: `E4:47:F8:61:83:DA:F6:CC:4B:97:B0:5F:89:69:53:92`
- **Password**: stored in `~/.gradle/gradle.properties` under `GROUNDWORK_UPLOAD_STORE_PASSWORD`. Never echoed. Use `keytool -storepass:env <var>` to verify, never `-storepass <literal>`.
- **Confirmed working**: 2026-05-02 — AAB signed with this keystore matches the SHA1 in `groundwork-upload_certificate.pem` and is what Play Console expects.

The keystore is intentionally outside the repo (Downloads folder). Gradle reads its path from `~/.gradle/gradle.properties` via `GROUNDWORK_UPLOAD_STORE_FILE` — must be the **absolute** path `C:/Users/cyr/Downloads/groundwork-upload.keystore`, not a bare filename (which would resolve to `android/app/` and pick up the WRONG legacy keystore `groundwork-release.keystore`). **If the file is missing or the path is wrong, the release build silently signs with the wrong key and Play rejects it.** Re-download into Downloads if it disappears.

**Do NOT confuse with the legacy `android/app/groundwork-release.keystore`** — that one is signed `CN=Corey Butler, O=TeezFPO` (SHA1 `E9:32:6C:E1:F0:89:4B:2E:72:79:A8:FA:EC:52:31:F0:39:61:3F:05`) and Play will reject any AAB signed with it.

**Why:** A previous upload key was lost, requiring a Play Console upload key reset (approved Apr 26 2026 06:38 UTC). The fingerprint above is what Play now expects on every uploaded AAB.

**How to apply:** Before any production AAB build, confirm the keystore exists at the path above and that its SHA1 matches. If Play rejects an upload with a signing-mismatch error, the keystore on disk is the wrong one.

## versionCode History

Play tracks consume versionCodes globally — a code used on internal/closed testing cannot be reused on production. As of v1.0.2:

| versionCode | versionName | Track | Status |
|---|---|---|---|
| 1 | 1.0 | Internal testing (Release1) | Active 13 Apr 2026 |
| 2 | 1.0 | Closed testing - Alpha (2.0) | Active 13 Apr 2026 |
| 3 | 1.0.2 | Production (first prod release) | Apr 26 2026 |

**How to apply:** Always increment `versionCode` past the highest one already on Play, regardless of track. Bumping `versionName` is optional but recommended. File: [android/app/build.gradle:10-11](android/app/build.gradle:10).

## Production AAB Build Recipe

```bash
# 1. Bump android/app/build.gradle versionCode + versionName
# 2. Build web assets and sync to Android
npm run build
npx cap sync android

# 3. Build signed release bundle
cd android && ./gradlew bundleRelease

# 4. Output is here, copy to Downloads for upload
cp android/app/build/outputs/bundle/release/app-release.aab /c/Users/cyr/Downloads/groundwork-release.aab

# 5. Verify signature
jarsigner -verify -verbose -certs /c/Users/cyr/Downloads/groundwork-release.aab | grep "jar verified"
```

## Build Config Notes

- `android/app/build.gradle` enables `ndk { debugSymbolLevel 'FULL' }` so Play stops warning about missing native debug symbols. Capacitor pulls in native libs that need symbols for crash analysis.
- `minifyEnabled false` for release — R8/proguard is **not** enabled. Play warns about missing deobfuscation file, but this is non-blocking. Don't flip to `true` without testing Capacitor reflection, Convex client, and OIDC code paths.
- The `signingConfigs.release` block is conditional on `GROUNDWORK_UPLOAD_STORE_FILE` being set. Without it, the release build produces an unsigned AAB (which Play rejects).

## Release Notes Format

Play Console's "Latest releases" UI requires release notes wrapped in language tags:
```
<en-US>
• ...bullet...
• ...bullet...
</en-US>
```
- All text must be inside the tags (no leading "What's new" header outside)
- Per-language cap is **500 characters**
