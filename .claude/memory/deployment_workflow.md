---
name: Deployment workflow
description: End-to-end deployment for web, Android, and Convex backend
type: workflow
---

## Full Deployment Checklist

### 1. Bump Version
- Edit `src/lib/version.ts` → increment `APP_VERSION`

### 2. Build & Deploy Web (VPS)
```bash
npm run build
scp -r dist/* root@172.233.163.131:/opt/groundwork/dist/
```
- VPS serves static files from `/opt/groundwork/dist/` via Nginx
- No git on VPS — just file copy
- Hard refresh (Ctrl+Shift+R) or clear service worker to see changes

### 3. Deploy Convex Backend
```bash
# Dev deployment (used by both localhost and VPS currently)
npx convex dev --once

# Prod deployment (not in active use yet)
npx convex deploy --yes
```

### 4. Build Android APK
```bash
npx cap sync android
cd android && ./gradlew assembleDebug
cp android/app/build/outputs/apk/debug/app-debug.apk /c/Users/cyr/Downloads/groundwork-debug.apk
```

### 5. Push to GitHub
```bash
git add <files>
git commit -m "message"
git push origin main
```

## Important Notes
- Deploy after each meaningful change (not batched)
- VPS auto-serves new files immediately after SCP — no restart needed
- Service worker may cache old version — users may need hard refresh
- Android APK must be manually installed on device after build
- `git config core.fileMode false` needed on Windows to avoid gradlew permission issues
