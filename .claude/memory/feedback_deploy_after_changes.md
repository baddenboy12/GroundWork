---
name: Deploy after each change
description: User wants commits pushed to VPS after each change, not batched
type: feedback
---

Commit and push to origin/main after each change so it deploys to the VPS immediately.

**Why:** User wants to see changes live on the VPS as they're made, not batched at the end.

**How to apply:** After completing and verifying each UI change, commit and `git push origin main` right away.
