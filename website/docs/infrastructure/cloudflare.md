---
id: cloudflare
title: Cloudflare Tunnel & Access
sidebar_position: 3
---

import ThemedImage from '@theme/ThemedImage';

# Cloudflare Tunnel & Access

All public traffic to Portage enters through a single Cloudflare tunnel; Cloudflare Access sits in front of it as the identity provider. There is no password anywhere in the stack — the edge authenticates the user, and the API verifies the edge's assertion.

<ThemedImage
  alt="Request path through Cloudflare tunnel and Access"
  sources={{light: '/portage/img/infra-request-path.svg', dark: '/portage/img/infra-request-path-dark.svg'}}
/>

## Tunnel Runbook

The tunnel ingress config is versioned in the repo and deployed by copy — the repo copy is the source of truth.

| What | Where |
|------|-------|
| Versioned config | `infra/cloudflared/config-portage.yml` |
| Live config | `/etc/cloudflared/config-portage.yml` |
| systemd service | `cloudflared-portage.service` (`cloudflared --no-autoupdate --config /etc/cloudflared/config-portage.yml tunnel run`) |
| Tunnel ID | `011e7e87-e141-4f72-8456-1267334b32ec` |
| Credentials | `/home/swebber64/.cloudflared/011e7e87-e141-4f72-8456-1267334b32ec.json` — a secret, **not** in the repo; only the ingress config is versioned |

:::warning Stale copy trap
`~/.cloudflared/config-portage.yml` also exists on the server, but it is a **stale copy** — systemd reads `/etc/cloudflared/` only. Never edit the home-directory copy expecting it to take effect.
:::

### Deploying a config change

```bash
sudo cp infra/cloudflared/config-portage.yml /etc/cloudflared/config-portage.yml
sudo systemctl restart cloudflared-portage
systemctl status cloudflared-portage --no-pager | head -5
```

Then verify the hostnames respond:

```bash
curl -s -o /dev/null -w '%{http_code}' https://portage.digitalharmonyai.com
```

### Editing rules

- **Edit the repo copy first**, then deploy with the commands above — never hand-edit `/etc/cloudflared/` and forget to sync back to the repo.
- The final `http_status:404` catch-all must stay **last** in the ingress list.
- The `portage-api` origin is HTTPS with `noTLSVerify: true` because the API serves a self-signed certificate (from `certs/`) — Cloudflare cannot verify it against a public CA, so origin TLS verification is disabled for that one hostname.

## Ingress Table

From `infra/cloudflared/config-portage.yml`:

| Hostname | Origin service | Notes |
|----------|----------------|-------|
| `portage.digitalharmonyai.com` | `http://localhost:3002` | Next.js app (portage-app) |
| `portage-api.digitalharmonyai.com` | `https://localhost:8016` | Express API (portage-api), `noTLSVerify: true` — self-signed origin cert |
| `dhgdocs.digitalharmonyai.com` | `http://localhost:8017` | Docs site (dhg-docs nginx) |
| `docs.digitalharmonyai.com` | `http://localhost:8017` | Docs site (same origin as above) |
| `rehearsal.digitalharmonyai.com` | `http://localhost:3004` | Placeholder ingress reserved for DHG Studios (Stephen, 2026-07-17); nothing listens on :3004 yet by design |
| *(catch-all)* | `http_status:404` | Must remain the last rule |

## Cloudflare Access

Cloudflare Access is Portage's identity provider. The application has **no password auth at all** — the CF Access policy in front of the tunnel is the login gate, and the Access allowlist is effectively the signup gate.

The flow, as implemented in `apps/api/src/routes/auth.ts` (`GET /auth/session`):

1. The edge authenticates the user against the IdP and Access policy, then forwards the request with a `Cf-Access-Jwt-Assertion` header.
2. The API verifies that assertion against the team JWKS at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (`apps/api/src/lib/cf-access.ts`, using `jose` — key rotation and refetching are handled by the cached remote JWKS). Issuer and audience are both checked.
3. Interactive logins carry an `email` claim; service-token requests (used by e2e) carry a `common_name` instead, which is mapped to a configured service identity only when it matches the expected common name exactly.
4. On first login the user row is **auto-provisioned** (with a 7-day Pro trial); concurrent first logins race safely on the unique email constraint.
5. The API mints a short-lived (**15-minute**) internal JWT (`apps/api/src/lib/jwt.ts`) that the rest of the API consumes. When it expires, the client simply re-exchanges via `GET /auth/session` — Cloudflare Access is the real session layer, so there is no refresh token.

### Required environment variables

From `apps/api/src/lib/env.ts`:

| Variable | Purpose |
|----------|---------|
| `CF_ACCESS_TEAM_DOMAIN` | Cloudflare Access team domain (defaults to `digitalharmonyai`); forms the JWKS/issuer URL |
| `CF_ACCESS_AUD` | Audience tag(s) of the Access application(s) protecting Portage — comma-separated, because the web app and API Access applications carry different audience tags. **Required in production** — startup fails without it |
| `CF_ACCESS_SERVICE_EMAIL` / `CF_ACCESS_SERVICE_COMMON_NAME` | Identity mapping for CF Access service-token requests (e2e); both must be set and the token's `common_name` must match |
| `CF_ACCESS_DEV_EMAIL` | Dev-only identity for LAN development with no Cloudflare edge in front; read only when `NODE_ENV=development` |
| `CF_API_TOKEN` / `CF_ACCOUNT_ID` / `CF_ACCESS_APP_IDS` | Cloudflare API access for the admin allowlist manager (Access:Edit scope); app IDs are comma-separated (web app + API hostname app) |

Values for all of these live in Doppler — see [Secrets & Storage](/docs/infrastructure/secrets-and-storage).

For the full session-exchange contract from the client's perspective, see [Authentication API](/docs/api/authentication). For the rest of the host layout, see [Infrastructure Overview](/docs/infrastructure/overview).
