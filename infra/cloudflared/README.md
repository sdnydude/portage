# Cloudflare tunnel — portage

Versioned copy of the live tunnel ingress config. The tunnel credentials JSON
(`/home/swebber64/.cloudflared/011e7e87-….json`) is a secret and is NOT in the
repo — only this ingress config is.

## Live wiring (g700data1)

- Live config: `/etc/cloudflared/config-portage.yml` (this file is its versioned copy)
- Service: `cloudflared-portage.service` →
  `cloudflared --no-autoupdate --config /etc/cloudflared/config-portage.yml tunnel run`
- Tunnel ID: `011e7e87-e141-4f72-8456-1267334b32ec` (Cloudflare account `6a8551be…`)
- Note: `~/.cloudflared/config-portage.yml` also exists but is a STALE copy —
  systemd reads `/etc/cloudflared/` only.

## Deploying a config change

```bash
sudo cp infra/cloudflared/config-portage.yml /etc/cloudflared/config-portage.yml
sudo systemctl restart cloudflared-portage
systemctl status cloudflared-portage --no-pager | head -5
```

Then verify the hostnames respond (e.g. `curl -s -o /dev/null -w '%{http_code}' https://portage.digitalharmonyai.com`).

## Editing rules

- Edit the repo copy first, deploy with the commands above — never hand-edit
  `/etc/cloudflared/` and forget to sync back here.
- The final `http_status:404` catch-all must stay last.
- `portage-api` origin is HTTPS with `noTLSVerify` (self-signed cert in `certs/`).
