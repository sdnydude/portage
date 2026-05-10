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
  "totalUsers": 150,
  "activeToday": 23,
  "totalItems": 4200,
  "activeListings": 890,
  "ordersThisMonth": 67,
  "revenueThisMonth": 28500
}
```

### Recent Activity

```
GET /admin/activity
```

Returns recent events (item_created, order_placed, user_registered) across all users.

### Users

```
GET    /admin/users              # List all users
GET    /admin/users/:id          # Get user details
PATCH  /admin/users/:id          # Update user (role, plan)
DELETE /admin/users/:id          # Delete user account
```

### Inventory (All Users)

```
GET /admin/inventory             # All items across all users
```

### Listings (All Users)

```
GET /admin/listings              # All listings across all users
```

### Orders (All Users)

```
GET /admin/orders                # All orders across all users
```

### Audit Log

```
GET /admin/audit                 # View admin action history
```

All admin mutations (role changes, deletions, setting updates) are recorded in the `admin_audit_log` table.

### App Settings

```
GET    /admin/settings           # Get system settings
PATCH  /admin/settings           # Update system settings
```

### Metrics

```
GET /metrics                     # Prometheus metrics endpoint
```

Returns Prometheus-formatted metrics for scraping. See [Monitoring](/docs/monitoring) for the full metrics list.

## Admin Layout

The admin panel uses a sidebar navigation layout:

- **Dashboard** — Stats grid + activity feed
- **Users** — User management table
- **Inventory** — Cross-user inventory view
- **Listings** — Cross-user listing management
- **Orders** — Cross-user order view
- **Porter** — AI assistant config
- **Marketplace** — Connection management
- **Observability** — System metrics
- **Settings** — System-level config
- **Audit** — Action history

Mobile: collapsible off-canvas sidebar. Desktop: static sidebar.
