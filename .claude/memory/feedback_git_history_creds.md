---
name: Git history credential leaks — accepted risk on private repos
description: Don't recommend git filter-repo / history rewrites for creds in committed private-repo history; rotate the creds instead
type: feedback
---

When credentials (API keys, keystore passwords, client secrets) have been committed to git history, don't push for `git filter-repo` / BFG history scrubs as the remediation.

**Why:** Corey's stance — "even though it's in git history I'm not too worried, the repo should be private anyway" (April 2026, after discovering PayPal sandbox creds + keystore password in `.claude/settings.local.json` history). Private repos limit exposure to collaborators, and rewrites are destructive + require force-push coordination.

**How to apply:** For committed creds:
1. Confirm the repo is actually private (don't assume — `gh repo view --json visibility`).
2. Rotate/revoke the exposed credential at the source (PayPal dashboard, Stripe, keystore regen, etc.).
3. Remove the cred from the current working tree + gitignore the file going forward.
4. **Do not** push history rewrites unless Corey explicitly asks. He treats private-repo history as acceptable-risk and the churn as not worth it.
