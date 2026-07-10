---
id: shipping
title: Shipping
sidebar_position: 7
---

# Shipping

The in-app carrier subsystem (package presets, rate shopping, label purchase, provider configuration) was **removed in PR #142** (2026-07-01). There is no EasyPost/Shippo integration and `apps/api/src/routes/shipping.ts` no longer exists — the planned carrier API integration was superseded by a redirect-to-eBay approach for labels.

## Current Approach

- **Ship It** on an order opens the item's eBay page, where the seller buys the label through eBay's own label flow
- **Mark as Shipped** is a plain order update: `PATCH /orders/:id` with `{ "status": "shipped", "trackingNumber": "...", "carrier": "..." }` — see [Orders](/docs/api/orders)
- **Fulfillment status syncs back** automatically: `POST /orders/sync` reads each order's fulfillment status from the eBay Fulfillment API, so orders shipped on eBay are marked shipped (or canceled) in Portage without manual action
