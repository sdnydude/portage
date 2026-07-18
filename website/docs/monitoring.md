---
id: monitoring
title: Monitoring
sidebar_position: 6
---

# Monitoring

Portage includes built-in observability via Prometheus metrics, pino structured logging, and an admin observability dashboard.

## Prometheus Metrics

The API exposes 8 custom metrics (plus Node.js default metrics, all `portage_`-prefixed) at `GET /metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `portage_http_requests_total` | Counter | Total HTTP requests by method, route, status code |
| `portage_http_request_duration_seconds` | Histogram | Request duration by method, route, status code |
| `portage_active_listings` | Gauge | Active listings by marketplace |
| `portage_orders_total` | Counter | Orders processed by marketplace and status |
| `portage_revenue_dollars_total` | Counter | Revenue in dollars by marketplace |
| `portage_scans_total` | Counter | Total item scans |
| `portage_ai_request_duration_seconds` | Histogram | AI API call duration by provider and operation |
| `portage_ebay_taxonomy_calls_total` | Counter | eBay taxonomy lookups by operation |

If `METRICS_SECRET` is set, the endpoint requires `Authorization: Bearer <secret>`. Scrape targeting is advertised via Docker Compose labels on the `portage-api` service (`prometheus.io/scrape: "true"`, `prometheus.io/port: "8016"`, `prometheus.io/path: "/metrics"`).

## Grafana Dashboard

A pre-built Grafana dashboard JSON is available for import — it lives in the repo at `observability/grafana/portage-dashboard.json`. It visualizes:

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

Docker health checks poll these endpoints to determine container health status — see [Deployment → Health Checks](/docs/deployment#health-checks) for the per-container probe configuration.

## Audit Logging

Admin actions are recorded in the `admin_audit_log` table:

- User management actions (role changes, account operations)
- System setting modifications
- Marketplace configuration changes

The audit log is viewable at `/admin/audit`.
