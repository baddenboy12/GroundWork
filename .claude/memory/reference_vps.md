---
name: VPS and GitHub access
description: VPS SSH access at 172.233.163.131 and GitHub repo for GroundWork deployments
type: reference
---

- **VPS**: `ssh root@172.233.163.131` — used for self-hosted GroundWork deployment
- **GitHub repo**: https://github.com/baddenboy12/GroundWork — origin remote for the project
- **Deployment flow**: Build locally with `pnpm build`, then `scp -r dist/* root@172.233.163.131:/opt/groundwork/dist/`
- **VPS project path**: `/opt/groundwork/dist/` (static files only, no git repo on VPS)
- **Nginx config**: `/etc/nginx/sites-enabled/groundwork`

**How to apply:** When deploying changes, push to GitHub, run `pnpm build` locally, then scp the dist/ contents to the VPS.
