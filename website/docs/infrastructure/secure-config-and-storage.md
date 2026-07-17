---
id: secrets-and-storage
title: Secrets & Storage
sidebar_position: 5
---

import ThemedImage from '@theme/ThemedImage';

# Secrets & Storage

Two things every Portage service depends on but that live outside the compose stack: secrets (Doppler) and image storage (Cloudflare R2). This page covers how each reaches the containers.

<ThemedImage
  alt="Secrets flow from Doppler to containers"
  sources={{light: '/portage/img/infra-secrets-path.svg', dark: '/portage/img/infra-secrets-path-dark.svg'}}
/>

## Secrets: Doppler → `.env` → Containers

All secrets live in **Doppler**. The `.env` file at the repo root is a local cache generated *from* Doppler, never edited by hand:

1. **Doppler project** holds the secrets (edit via the dashboard or the `/secrets` skill).
2. **SessionStart hook** — `.claude/hooks/doppler-sync.sh`, wired in `.claude/settings.json` — regenerates `.env` at the start of every Claude Code session via `doppler secrets download --no-file --format env > .env`. It exits silently if Doppler isn't installed or configured for the directory.
3. **Compose** injects the file into the API container with `env_file: .env` (`docker-compose.yml`); the API validates the result against the Zod schema in `apps/api/src/lib/env.ts` at startup.

Never commit secrets — `.env` is a generated cache, and everything in it is recoverable from Doppler.

The full Doppler workflow (CLI setup, `/secrets` skill reference, service tokens, security practices) is documented once, on the shared docs site: [Doppler — Secrets Management](http://10.0.0.251:8017/infrastructure/doppler/). This page deliberately does not duplicate it.

## TLS Certificates

The `certs/` directory holds a self-signed certificate pair (`cert.pem` / `key.pem`) with SAN `10.0.0.251`. Per `docker-compose.yml`:

- Mounted read-only into **both** app containers: `./certs:/app/certs:ro` on `portage-api` and `portage-app`.
- The API serves HTTPS with it on :8016.
- The app container sets `NODE_EXTRA_CA_CERTS: /app/certs/cert.pem` so its server-side `/backend/*` rewrite (which targets `https://10.0.0.251:8016`) can verify the API's self-signed cert instead of rejecting it.

The Cloudflare tunnel handles the same cert on its side with `noTLSVerify` — see [Cloudflare Tunnel & Access](/docs/infrastructure/cloudflare).

## Marketplace Token Encryption

Marketplace OAuth tokens are encrypted at rest with **AES-256-GCM** (`apps/api/src/lib/crypto.ts`): a 12-byte random IV per encryption, key derived via scrypt from the `ENCRYPTION_KEY` environment variable (required, minimum 64 characters per `env.ts` — deliberately decoupled from `JWT_SECRET`). Stored format is `iv:authTag:ciphertext` in hex. The key value, like everything else, lives in Doppler.

## Image Storage: Cloudflare R2

Item photos are stored in a Cloudflare R2 bucket, accessed through the standard AWS S3 SDK (`apps/api/src/lib/storage.ts`):

- **Client config:** `S3Client` with `region: 'auto'` and endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, authenticated with `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
- **Key scheme:** uploads land at `items/<userId>/<yyyy/mm/dd>/<uuid><ext>` in the `R2_BUCKET_NAME` bucket; the stored public URL is `R2_PUBLIC_URL` + key.
- **Env vars** (all declared in `apps/api/src/lib/env.ts`): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

### Serving paths

There are two ways an image gets from R2 to a browser:

1. **Public bucket domain, proxied same-origin** — `apps/web/next.config.ts` rewrites `/img-cdn/:path*` to `https://portage-images.digitalharmonyai.com/:path*` (the R2 public domain). The rewrite exists because the R2 public domain sends no CORS headers, which taints any canvas capture; proxying through the app origin sidesteps CORS entirely. This is the path used by the listing preview share card (`/img-cdn/<key>` as the hero image source for PNG capture). Item photo URLs stored on records point at the public domain directly.
2. **Authenticated API proxy** — `GET /images/r2/*path` (`apps/api/src/routes/images.ts`, the `/r2/*path` handler) streams an object from R2 via `GetObject`, after enforcing that the key starts with `items/<requesting user>/` (403 otherwise), with `Cache-Control: public, max-age=31536000, immutable`. It requires the standard auth token like the rest of the images router. No frontend consumer of this route currently exists in the repo — it is an ownership-checked server-side fetch path, available when a client needs an image without going through the public domain.

### Provisioning

The R2 bucket and its API token are created in the Cloudflare dashboard; the resulting credentials live in Doppler under the `R2_*` variable names above.

See also: [Environment Variables](/docs/environment-variables), [Images API](/docs/api/images), [Infrastructure Overview](/docs/infrastructure/overview).
