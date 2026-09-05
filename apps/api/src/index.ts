// Must precede every other import: it patches the Anthropic SDK and starts the
// OpenTelemetry SDK before any client or route module is constructed.
import { shutdownTracing } from './instrumentation.js';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './lib/env.js';
import { createApp } from './app.js';
import { startSyncWorker } from './lib/sync-worker.js';

const config = loadEnv();
const app = createApp();

// Outbox worker (sync refactor P2): executes queued marketplace edit-syncs.
// Started here, not in createApp, so the test app never spins a timer.
startSyncWorker();

// Docker stops the container with SIGTERM; flush queued spans before exit so a
// deploy doesn't silently drop the traces of in-flight requests.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdownTracing().finally(() => process.exit(0));
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = resolve(__dirname, '../../../certs');

try {
  const sslOptions = {
    key: readFileSync(resolve(certDir, 'key.pem')),
    cert: readFileSync(resolve(certDir, 'cert.pem')),
  };
  https.createServer(sslOptions, app).listen(config.API_PORT, () => {
    console.log(`portage-api listening on https://10.0.0.251:${config.API_PORT}`);
  });
} catch (err) {
  if (config.NODE_ENV === 'production') {
    console.error('FATAL: HTTPS certs missing in production:', (err as Error).message);
    process.exit(1);
  }
  console.warn('HTTPS disabled (dev):', (err as Error).message);
  app.listen(config.API_PORT, () => {
    console.log(`portage-api listening on http://10.0.0.251:${config.API_PORT}`);
  });
}
