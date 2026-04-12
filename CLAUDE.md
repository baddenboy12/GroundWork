# GroundWork — Claude Session Bootstrap

## Memory Recall

On session start, read `.claude/memory/MEMORY.md` for the full index, then load relevant memory files based on the user's request. Key files:

- **Always load**: `project_overview.md`, `user_profile.md`, `deployment_workflow.md`
- **For exports/PDF/Excel work**: `export_system.md`
- **For Android/mobile/APK work**: `android_capacitor.md`
- **For billing/subscriptions**: `team_subscription_billing.md`, `subscription_carousel.md`
- **For debugging/Convex**: `convex_debug_tools.md`
- **For VPS/deploy/auth**: `reference_vps.md`
- **For UI/frontend**: `ui_mobile_optimizations.md`, `ui_text_scaling.md`
- **For landing page**: `landing_page.md`

## Project Quick Reference

- **App**: GroundWork — field site inspection logging PWA
- **Version**: v242 (check `src/lib/version.ts` for current)
- **Live URL**: https://groundwork.teezfpo.com
- **VPS**: `ssh root@172.233.163.131` — static files at `/opt/groundwork/dist/`
- **Repo**: https://github.com/baddenboy12/GroundWork
- **Stack**: React 19 + Vite 7 + Convex + Tailwind 4 + Capacitor 7
- **Auth**: Keycloak OIDC at https://auth.teezfpo.com
- **Owner**: Corey Butler (baddenboy12@gmail.com)

## Deploy Cheat Sheet

```bash
# Web: build + SCP to VPS
npm run build && scp -r dist/* root@172.233.163.131:/opt/groundwork/dist/

# Convex: push backend
npx convex dev --once        # dev deployment
npx convex deploy --yes      # prod deployment

# Android: sync + build APK
npx cap sync android && cd android && ./gradlew assembleDebug
cp android/app/build/outputs/apk/debug/app-debug.apk /c/Users/cyr/Downloads/groundwork-debug.apk
```

## Session Conventions

- Deploy after each meaningful change (web + APK if mobile-relevant)
- Bump `APP_VERSION` in `src/lib/version.ts` for visible changes
- Use `git config core.fileMode false` to avoid gradlew permission issues on Windows
- Test exports on both web and mobile — they use different save paths
- Corey prefers concise communication — show results, not process
