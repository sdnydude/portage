---
id: ci-cd
title: CI/CD & Docs Pipeline
sidebar_position: 4
---

import ThemedImage from '@theme/ThemedImage';

# CI/CD & Docs Pipeline

Portage uses GitHub Actions with a split runner model: quality gates run on GitHub-hosted runners, while anything that touches the g700data1 host (docs deploy, e2e, review tooling) runs on a self-hosted runner installed on the server itself.

<ThemedImage
  alt="Docs deploy pipeline"
  sources={{light: '/portage/img/infra-deploy-path.svg', dark: '/portage/img/infra-deploy-path-dark.svg'}}
/>

## Self-Hosted Runner

A GitHub Actions runner is installed on g700data1 at `~/actions-runner` and runs as a systemd service:

```
actions.runner.sdnydude-portage.g700data1.service
```

(loaded, active, running — labelled "GitHub Actions Runner (sdnydude-portage.g700data1)").

Which workflows run where, per `runs-on` in `.github/workflows/`:

| Workflow | Runner |
|----------|--------|
| `deploy-docs.yml` | `self-hosted` |
| `e2e.yml` | `self-hosted` |
| `claude-review.yml` | `self-hosted` |
| `ci.yml` (3 jobs) | `ubuntu-latest` (GitHub-hosted) |

The split is deliberate: `deploy-docs` and `e2e` need direct access to the host filesystem, Docker daemon, and LAN services, which only the on-box runner has.

## `deploy-docs.yml` Step by Step

Triggered on push to `main` when any file under `website/**` changes (plus manual `workflow_dispatch`). A `docs-deploy` concurrency group serializes runs without cancelling in-progress deploys.

### 1. Copy docs into the shared docs-site

Portage docs are not built standalone — they are copied into the shared AI Factory Docusaurus site and built there:

```
website/docs  →  /home/swebber64/DHG/aifactory3.5/dhgaifactory3.5/docs-site/projects/portage
```

The previous copy is removed first (`rm -rf`), then two `sed` rewrites run over every copied `.md` file:

- `](/docs/` → `](/portage/` — in the repo, docs cross-reference each other with absolute `/docs/...` links; on the deployed shared site, Portage docs live under the `/portage/` route prefix instead. Without this rewrite every internal link would 404.
- `](/img/` → `](/portage/img/` — image assets are copied to `static/portage/img` on the shared site (served at `/portage/img/...`), but repo docs reference `/img/...`. Without this rewrite every image would 404 on the deployed site.

Note these rewrites only match markdown link syntax (`](...`), which is why `<ThemedImage>` JSX blocks reference `/portage/img/...` paths directly in the source.

Finally, static assets are copied recursively: `website/static/img/.` → `$DOCS_SITE/static/portage/img/` (recursive on purpose — an earlier `*.svg` glob silently dropped everything in subdirectories like `img/sitemap` and `img/verification`, plus PDFs).

### 2. Build Docusaurus

`npm install && npm run build` inside the shared docs-site, with a 15-minute timeout and `NODE_OPTIONS='--max-old-space-size=4096'`.

### 3. Restart the docs container

The primary mechanism is `docker restart dhg-docs`. If that fails (container missing), a fallback `docker run` recreates it: `nginx:alpine`, port `8017:80`, restart `unless-stopped`, with two read-only bind mounts — the docs-site `build/` directory to `/usr/share/nginx/html` and the docs-site `nginx.conf` to `/etc/nginx/conf.d/default.conf`.

A live `docker inspect dhg-docs` confirms the running container matches exactly that fallback shape (both ro bind mounts, port 8017, `unless-stopped`) — so the restart-in-place path is what runs on a normal deploy, against a container originally created with the fallback configuration. Because the build output is bind-mounted, a rebuild plus restart is all a deploy needs.

### 4. Ingest into the DHG Registry

`doc_ingest.py` (in the AI Factory registry directory) re-ingests the deployed Portage docs into the registry's `doc_pages` table for hybrid search, under memory guards (`ulimit -v` 3 GiB, `MALLOC_ARENA_MAX=2`). This step is `continue-on-error: true` — a registry hiccup never blocks a docs deploy. See [Registry Integration](/docs/development/registry-integration).

### 5. Verify

The final step curls `http://localhost:8017/portage/getting-started/` (hard failure if the site is down) and reports the registry chunk count from `http://localhost:8011/api/doc-pages?project_name=portage`.

## App Deploy Path (Contrast)

The application containers are **not** CI-deployed. `portage-api` and `portage-app` run as image-baked containers (no source bind mounts), and deployment is an operator action on the host: `docker compose up -d --build <service>`. Pushing to `main` does not redeploy the app — only the docs pipeline is automated. Hot-reload development is an explicit opt-in overlay (`docker-compose.dev.yml`); the default is always the baked prod image. See [Deployment](/docs/deployment) for the full procedure and [Infrastructure Overview](/docs/infrastructure/overview) for the host layout.
