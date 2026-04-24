---
name: npx convex run requires --prod flag for production deployment
description: Without --prod, convex run defaults to the dev deployment set in .env.local — not prod
type: reference
---

`npx convex run <module>:<fn>` reads the `CONVEX_DEPLOYMENT` env var from `.env.local` to pick a deployment. In this project `.env.local` points to the **dev** Convex (`useful-ox-860`), so running without a flag targets dev.

**Always pass `--prod` when running against production** (`warmhearted-barracuda-277`):

```bash
npx convex run --prod <module>:<fn> '<json-args>'
```

## Diagnostic heuristic

Symptom: `npx convex deploy --yes` succeeds, `npx convex function-spec --prod` lists your new function, but `npx convex run <module>:<fn>` returns "Could not find function" with a truncated available-functions list. That truncated list is the *dev* deployment's functions. Add `--prod`.

## Why the deploy output is misleading

`npx convex deploy` always targets prod by default (that's documented in `convex deploy --help`). `npx convex run` does NOT default to prod — it follows `CONVEX_DEPLOYMENT`. This asymmetry between the two commands is the trap.

## Useful alternative: function-spec

To confirm what's actually deployed without running anything:

```bash
npx convex function-spec --prod | grep "identifier" | grep <substring>
```

Faster than redeploying repeatedly to debug whether your function made it upstream.
