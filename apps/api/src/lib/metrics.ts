import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'portage_' });

export const httpRequestDuration = new client.Histogram({
  name: 'portage_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const httpRequestTotal = new client.Counter({
  name: 'portage_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const activeListings = new client.Gauge({
  name: 'portage_active_listings',
  help: 'Number of active listings',
  labelNames: ['marketplace'] as const,
});

export const ordersTotal = new client.Counter({
  name: 'portage_orders_total',
  help: 'Total orders processed',
  labelNames: ['marketplace', 'status'] as const,
});

export const revenueTotal = new client.Counter({
  name: 'portage_revenue_dollars_total',
  help: 'Total revenue in dollars',
  labelNames: ['marketplace'] as const,
});

export const scanTotal = new client.Counter({
  name: 'portage_scans_total',
  help: 'Total item scans',
});

export const aiLatency = new client.Histogram({
  name: 'portage_ai_request_duration_seconds',
  help: 'Duration of AI API calls',
  labelNames: ['provider', 'operation'] as const,
  buckets: [0.5, 1, 2, 5, 10, 30],
});

export const ebayTaxonomyCalls = new client.Counter({
  name: 'portage_ebay_taxonomy_calls_total',
  help: 'Total eBay Taxonomy/Metadata API lookups by operation',
  labelNames: ['operation'] as const,
});

export const metricsRegistry = client.register;
