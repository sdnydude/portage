---
title: "Reverb shipping profiles + shipping UI (seller profile)"
sidebar_label: "Reverb shipping profiles + shipping UI (seller pro"
sidebar_position: 116
slug: ship-c32ffda3
registry_id: c32ffda3-a8d5-4529-9dd3-e9a35af4290f
generated: true
---

# Reverb shipping profiles + shipping UI (seller profile)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-07-21 |
| **Model** | claude-fable-5 |

## Approach

Reverb-recommended shipping_profile_id flow: adapter getShippingProfiles (GET /shop), shipping_profile_id on create/update (wins over rates), GET /marketplace/reverb/shipping-profiles endpoint, seller-profile zod accepts shippingProfileId, publish enrichment fills shippingProfileId+localPickup from profile, new settings section (profile dropdown + local pickup + save). Per-listing rates kept as legacy fallback.

## Verification

- **lint:** clean
- **tests:** 718 api / 553 web
- **typecheck:** pass

**Tags:** `reverb`, `shipping`, `seller-profile`
