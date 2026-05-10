---
id: monitoring
title: Monitoring
sidebar_position: 3
---

# Monitoring

Portage includes built-in observability via Prometheus metrics, pino structured logging, and an admin observability dashboard.

## Prometheus Metrics

The API exposes 7 metrics at `GET /metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `portage_http_requests_total` | Counter | Total HTTP requests by method, route, status |
| `portage_http_request_duration_seconds` | Histogram | Request duration by route |
| `portage_active_users_total` | Gauge | Currently active users |
| `portage_items_total` | Gauge | Total inventory items |
| `portage_listings_total` | Gauge | Total marketplace listings by status |
| `portage_orders_total` | Gauge | Total orders by status |
| `portage_ai_scans_total` | Counter | AI scan requests by status (success/failure) |

## Grafana Dashboard

A pre-built Grafana dashboard JSON is available for import. It visualizes:

- Request rate and error rate over time
- Response time percentiles (p50, p95, p99)
- Active users trend
- Inventory and listing counts
- Order volume
- AI scan success rate

## Structured Logging

All services use **pino** for structured JSON logging with a shared root logger:

```typescript
import { createLogger } from '../lib/logger';
const logger = createLogger('route-name');

logger.info({ userId, itemId }, 'Item created');
logger.error({ err }, 'Failed to sync orders');
```

The root logger is defined in `apps/api/src/lib/logger.ts`. All route files, middleware, and marketplace adapters use child loggers created via `createLogger()`.

HTTP request logging uses `pino-http` wired to the shared root logger for consistent log formatting.

## Admin Observability Page

The admin panel includes an observability page at `/admin/observability` that surfaces:

- System health status
- Recent error logs
- Performance metrics summary
- Service uptime

Access requires `role=admin` on the user account.

## Health Endpoints

| Endpoint | Service | Response |
|----------|---------|----------|
| `GET /health` | API | `{ status: "ok", timestamp }` |
| `GET /` | Web | Next.js renders the app |

Docker health checks poll these endpoints to determine container health status.

## Audit Logging

Admin actions are recorded in the `admin_audit_log` table:

- User management actions (role changes, account operations)
- System setting modifications
- Marketplace configuration changes

The audit log is viewable at `/admin/audit`.
