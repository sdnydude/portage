---
title: "Deferral P1: eBay account-deletion compliance, fork-PR gating, prod boot guard"
sidebar_label: "Deferral P1: eBay account-deletion compliance"
sidebar_position: 56
registry_id: 9d934543-2948-4f30-bd70-e59e4d798884
---

# Deferral P1: eBay account-deletion compliance, fork-PR gating, prod boot guard

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | yes |
| **Branch** | `feat/deferral-p1-compliance` |
| **PR** | [#309](https://github.com/sdnydude/portage/pull/309) (merged 2026-08-20, `5f8ff7a`) |
| **Deferred** | 0 |

First ship of the deferral program (docs/deferral-plan-2026-08-15.md). Three items:

- **`c683b4bc` (critical)** — public `/marketplace/ebay/account-deletion`: challenge handshake, ECDSA-SHA1 signature verification against eBay Notification API keys, synchronous single-transaction anonymization (accounts / orders / messages / notifications), HMAC-keyed `ebay_deleted_identities` idempotency gate + sync re-population guard with post-sync sweep, two-tier rate limiting, CF Access path bypass. Registered in the eBay portal (persist-data exemption lifted); live test notification verified end-to-end.
- **`223b0419` (high)** — e2e.yml + claude-review.yml refuse fork PRs before checkout (fail, not skip, so the required check blocks merges).
- **`73dd1664` (high)** — prod boot guard widened to 14 requirements (R2, eBay creds any-of-keyset, Stripe incl. price ids, deletion envs) with aggregate missing-key error.

9 review/advisor rounds; 1 blocker + 4 majors found and fixed in-branch. Tests 1011 API / 650 web. Proof artifacts: `docs/proof/2026-08-19-p1-*`, `docs/proof/2026-08-20-p1-*`.
