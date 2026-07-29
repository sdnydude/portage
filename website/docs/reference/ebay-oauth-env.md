---
id: ebay-oauth-env
title: eBay OAuth Environment & RuNames
sidebar_position: 3
---

# eBay OAuth Environment & RuNames

Reference for the env vars behind the eBay account-connect flow
(`GET /marketplace/ebay/connect` → eBay consent → `POST /marketplace/ebay/callback`),
and the two production incidents (2026-07-26 → 07-28) that motivated writing this down.

## How the flow picks its configuration

`apps/api/src/routes/marketplace/ebay-auth.ts` builds the consent URL from three inputs:

1. **Host** — `EBAY_SANDBOX` switches `auth.ebay.com` / `api.ebay.com` vs the
   `*.sandbox.ebay.com` equivalents (`ebayAuthUrl()` / `ebayBaseUrl()`).
2. **Keyset** — `getEbayUserFlowCredentials()`
   (`apps/api/src/marketplace/ebay-credentials.ts`): when `EBAY_SANDBOX=false` it uses
   `EBAY_PROD_CLIENT_ID`/`EBAY_PROD_CLIENT_SECRET`, falling back to the base
   `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` (the sandbox keyset) if unset.
3. **Redirect** — `EBAY_REDIRECT_URI`, passed as the OAuth `redirect_uri` parameter to
   both the consent URL and the token exchange.

## The RuName trap

eBay's OAuth does **not** take a callback URL in `redirect_uri`. It takes the **RuName**
— eBay's registered name for the redirect config on that keyset (the actual `https://…`
callback URL lives inside the RuName's configuration in the eBay developer portal).

Two consequences:

- `EBAY_REDIRECT_URI` must hold a RuName string like
  `Digital_Harmony-DigitalH-click2-cefmyzh`, **never** the literal callback URL.
  (`.env.example` historically showed a URL placeholder here — that placeholder leaking
  into a real config was the root cause of the 07-28 outage below.)
- RuNames are **keyset-specific**. The production keyset (`DigitalH-click2li-PRD-…`) and
  sandbox keyset (`DigitalH-click2li-SBX-…`) each have their own; they are not
  interchangeable.

| Keyset | Client ID prefix | RuName |
|--------|-----------------|--------|
| Production | `DigitalH-click2li-PRD-…` | `Digital_Harmony-DigitalH-click2-cefmyzh` |
| Sandbox | `DigitalH-click2li-SBX-…` | `Digital_Harmony-DigitalH-click2-hrjbkmyj` |

`EBAY_RUNAME` (holding the sandbox RuName) is **dead config** — no code reads it. It
exists only as a place the sandbox value was recorded. The live value is whatever sits
in `EBAY_REDIRECT_URI`.

## Failure signatures

Symptoms observed at `https://auth.ebay.com/oauth2/authorize`, useful for triage:

| Response | Meaning |
|----------|---------|
| Redirect to `signin.ebay.com` | Parameters accepted — flow is healthy |
| `errorOauth?errorId=invalid_request` (`"Input request parameters are invalid."`) | Client ID is valid but `redirect_uri` doesn't match any RuName on that keyset — the URL-instead-of-RuName mistake, or a RuName from the other keyset |
| `errorOauth?errorId=unauthorized_client` | Client ID itself unknown/invalid |

The `invalid_request` verdict comes from eBay's server; the API's own
`/marketplace/ebay/connect` returns 200 regardless, since it only assembles the URL.
Diagnose by curling the built consent URL and following redirects.

## Incident history (2026-07-26 → 07-28)

The 07-26 Doppler resync/gutting (the same incident that broke `CF_ACCESS_AUD`) left two
independent regressions in the eBay OAuth config, restored in sequence on 07-28:

1. **`EBAY_SANDBOX` flipped to `true`** in both Doppler configs (dev + prd) — consent
   went to `auth.sandbox.ebay.com` despite live selling since June. Fixed by setting
   `false` in both configs.
2. **`EBAY_REDIRECT_URI` replaced with the callback URL** from the `.env.example`
   placeholder — after fix 1, prod consent then failed with `invalid_request`. The
   pre-gutting backup (`.env.bak.20260726-191756`) held the working value: the prod
   RuName `Digital_Harmony-DigitalH-click2-cefmyzh`. Confirmed by bisecting curl calls
   against `auth.ebay.com` (URL → `invalid_request`; RuName → signin page), then
   restored in Doppler dev + prd.

Lesson: after any bulk env restore, verify `EBAY_SANDBOX` **and** that
`EBAY_REDIRECT_URI` is a RuName — the publish path mostly hardcodes prod endpoints and
keeps working, so a broken OAuth config only surfaces when someone tries to connect an
account.

## Recovery checklist

```bash
# 1. Verify what the running container actually has
docker exec portage-api printenv EBAY_SANDBOX EBAY_REDIRECT_URI EBAY_PROD_CLIENT_ID

# 2. Fix in Doppler (both configs), never .env directly
doppler secrets set EBAY_SANDBOX=false
doppler secrets set EBAY_SANDBOX=false --config prd
doppler secrets set EBAY_REDIRECT_URI=Digital_Harmony-DigitalH-click2-cefmyzh
doppler secrets set EBAY_REDIRECT_URI=Digital_Harmony-DigitalH-click2-cefmyzh --config prd

# 3. Resync + recreate
bash .claude/hooks/doppler-sync.sh
docker compose up -d --force-recreate portage-api
```

Accounts connected while the config was broken (if any) hold sandbox or no tokens —
disconnect and reconnect them after recovery.
