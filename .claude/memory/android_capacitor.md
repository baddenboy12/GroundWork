---
name: Android / Capacitor native app
description: Capacitor-based Android app with native auth, file export, and share functionality
type: feature
---

## Overview
GroundWork's Android app is built with Capacitor 7, replacing the older TWA (Trusted Web Activity) approach. It wraps the web app in a native WebView with access to native APIs.

## Key Plugins
- `@capacitor/filesystem` — write files to device storage (cache dir)
- `@capacitor/share` — open system share sheet for files
- `@capacitor/browser` — in-app browser (used for some auth flows)
- Custom WebView dialog for Keycloak auth (avoids Chrome Custom Tabs URL bar)

## Auth Flow
- Native auth uses a custom dialog-based WebView (not Browser plugin)
- Keycloak OIDC with manual PKCE code verifier
- Sign-in opens WebView dialog → user authenticates → callback captured → dialog closes
- Sign-out clears Keycloak session cookies + redirects

## Build Process
```bash
# Sync web assets to Android project
npx cap sync android

# Build debug APK
cd android && ./gradlew assembleDebug

# APK output location
android/app/build/outputs/apk/debug/app-debug.apk

# Copy to Downloads for easy access
cp android/app/build/outputs/apk/debug/app-debug.apk /c/Users/cyr/Downloads/groundwork-debug.apk
```

## Key Files
- `capacitor.config.ts` — Capacitor configuration
- `android/app/src/main/AndroidManifest.xml` — permissions (internet, location, file access)
- `src/lib/platform.ts` — `isNative` detection for platform-specific code paths
- `src/pages/dashboard/_lib/export.ts` — `nativeSaveFile()` for Capacitor file export

## Known Issues & Fixes (March 2026)
- **Exports not saving**: Fixed by adding Filesystem + Share plugins (was silently failing with blob URL download)
- **Slow export (40s)**: Fixed by chunked base64 conversion instead of char-by-char string concat
- **Auth stuck on back button**: Fixed with dialog WebView approach
- **Status bar inset**: Fixed with proper WindowInsets listener
- **File mode issue**: `android/gradlew` has file mode conflicts on Windows — use `git config core.fileMode false`
