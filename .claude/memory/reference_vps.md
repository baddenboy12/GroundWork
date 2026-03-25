---
name: VPS, GitHub, and Keycloak access
description: VPS SSH, GitHub repo, and Keycloak admin API for GroundWork deployments and auth management
type: reference
---

## VPS
- **SSH**: `ssh root@172.233.163.131`
- **Project path**: `/opt/groundwork/dist/` (static files only, no git repo on VPS)
- **Nginx config**: `/etc/nginx/sites-enabled/groundwork`
- **Live URL**: `https://groundwork.teezfpo.com`

## GitHub
- **Repo**: https://github.com/baddenboy12/GroundWork — origin remote

## Deployment Flow
1. Commit and push to GitHub
2. Run `pnpm build` locally
3. `scp -r dist/* root@172.233.163.131:/opt/groundwork/dist/`
4. Convex backend syncs via `convex dev` (dev deployment) — start with `pnpm convex dev` if not running

## Keycloak Admin API
- **Endpoint**: `https://auth.teezfpo.com`
- **Realm**: `groundwork`
- **Admin username**: `corey`
- **Admin password**: `REDACTED_PASSWORD`
- **Client ID used by app**: `groundwork-app`

### Authentication
```bash
# Get admin token (expires in 60s)
curl -s -X POST "https://auth.teezfpo.com/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=corey" \
  -d "password=REDACTED_PASSWORD" \
  -d "grant_type=password"
```

### Common API calls
```bash
TOKEN=$(curl -s -X POST "https://auth.teezfpo.com/realms/master/protocol/openid-connect/token" -d "client_id=admin-cli" -d "username=corey" -d "password=REDACTED_PASSWORD" -d "grant_type=password" | jq -r '.access_token')

# Get client config (groundwork-app)
curl -s -H "Authorization: Bearer $TOKEN" "https://auth.teezfpo.com/admin/realms/groundwork/clients?clientId=groundwork-app"

# List users
curl -s -H "Authorization: Bearer $TOKEN" "https://auth.teezfpo.com/admin/realms/groundwork/users"

# Get client redirect URIs (replace CLIENT_UUID)
curl -s -H "Authorization: Bearer $TOKEN" "https://auth.teezfpo.com/admin/realms/groundwork/clients/CLIENT_UUID"
```

### Important Config
- **Valid Redirect URIs**: must include `https://groundwork.teezfpo.com/*` and `http://localhost:5173/*`
- **Valid Post Logout Redirect URIs**: must include `https://groundwork.teezfpo.com/*` and `http://localhost:5173/*`
- OIDC redirect in app: `${window.location.origin}/auth/callback`
- Post-logout redirect in app: `window.location.origin`

**How to apply:** Use the Keycloak Admin REST API to manage auth settings, debug redirect URI issues, and manage users. Re-authenticate before each call since tokens expire in 60s.
