---
id: admin
title: Admin
sidebar_position: 10
---

# Admin

System administration endpoints. All require `role=admin` on the authenticated user.

## Endpoints

### Dashboard Stats

```
GET /admin/stats
```

**Response** `200`:

```json
{
  "users": { "total": 150, "activeToday": 23, "newLastWeek": 4 },
  "items": { "total": 4200 },
  "listings": { "active": 890, "total": 1200 },
  "orders": { "thisMonth": 67, "revenueThisMonth": 28500 }
}
```

### Recent Activity

```
GET /admin/activity
```

Returns recent events (item_created, order_placed, user_registered) across all users.

### Users

```
GET    /admin/users                    # List all users
POST   /admin/users                    # Create a user ahead of first login (adds CF allowlist entry)
GET    /admin/users/:id                # Get user details
PATCH  /admin/users/:id                # Update user (role, tier, displayName, trial, credits, limit overrides, archive/enable)
DELETE /admin/users/:id                # Delete user account
POST   /admin/users/:id/reset-usage    # Reset monthly AI scan + background-removal counters
```

`POST /admin/users/:id/reset-usage` zeroes `aiScansThisMonth` and `bgRemovalsThisMonth` and stamps the reset date. It does not touch the daily Porter exchange count or AI listing credits.

`PATCH /admin/users/:id` accepts `role` (`user`|`admin`), `subscriptionTier` (`free`|`pro`|`beta-tester`), `displayName`, `trialEndsAt`, `aiListingCredits`, per-meter `limitOverrides` (aiScansPerMonth, aiListingsPerMonth, bgRemovalsPerMonth, porterExchangesPerDay, marketplaces — number overrides tier, `null` = unlimited), and `disabled` (archiving also removes the user's Cloudflare Access allowlist entry, so sessions die at the edge). Admins cannot modify their own account.

### Cloudflare Access Allowlist

```
GET    /admin/allowlist            # List allowlisted emails
POST   /admin/allowlist            # Add an email
DELETE /admin/allowlist/:email     # Remove an email
```

Cloudflare Access is the identity provider; the allowlist is the signup gate. User create/archive keeps it in sync automatically.

### Inventory (All Users)

```
GET /admin/items                 # All items across all users
```

### Listings (All Users)

```
GET /admin/listings              # All listings across all users
```

### Orders (All Users)

```
GET /admin/orders                # All orders across all users
GET /admin/orders/revenue        # Revenue aggregates
```

### Porter (All Users)

```
GET /admin/porter/stats          # Porter usage stats
GET /admin/conversations         # All Porter conversations
GET /admin/conversations/:id     # Single conversation
```

### Marketplace Health

```
GET /admin/marketplace/health    # Connection health across marketplaces
```

### FAQs

```
GET    /admin/faqs               # List FAQs (including unpublished)
POST   /admin/faqs               # Create FAQ
PATCH  /admin/faqs/:id           # Update FAQ
DELETE /admin/faqs/:id           # Delete FAQ
PUT    /admin/faqs/reorder       # Reorder FAQs
```

Backs the DB-backed FAQ system; users read published FAQs via `GET /faqs` (authenticated).

### Audit Log

```
GET /admin/audit                 # View admin action history
```

All admin mutations (role changes, deletions, setting updates) are recorded in the `admin_audit_log` table.

### App Settings

```
GET    /admin/settings           # Get system settings
PATCH  /admin/settings/:key      # Update a single setting by key
```

The PATCH key is checked against a server-side allowlist that currently contains only `maintenance_mode` — any other key is rejected with `400 INVALID_KEY`.

### Metrics

```
GET /metrics                     # Prometheus metrics endpoint
```

Returns Prometheus-formatted metrics for scraping (guarded by a `METRICS_SECRET` bearer token when configured, not by the admin role). See [Monitoring](/docs/monitoring) for the full metrics list.

## Admin Layout

The admin panel uses a sidebar navigation layout:

- **Dashboard** — Stats grid + activity feed
- **Users** — User management table
- **Inventory** — Cross-user inventory view
- **Listings** — Cross-user listing management
- **Orders** — Cross-user order view
- **Porter** — Usage stats + conversation browser (read-only; there is no Porter config endpoint)
- **Marketplace** — Connection management
- **Observability** — System metrics
- **Settings** — System-level config
- **Audit** — Action history

Mobile: collapsible off-canvas sidebar. Desktop: static sidebar.
