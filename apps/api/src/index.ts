import https from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './lib/env.js';
import { createApp } from './app.js';

const config = loadEnv();
const app = createApp();

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
