import { pino, type LoggerOptions } from 'pino';

/** Shared pino options — exported so tests can build an instance against a
 *  capture stream. `redact` masks secret-bearing header values before they
 *  reach stdout/Loki (P5 T6); it masks, never drops, per the keep-all rule. */
export const loggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["cf-access-jwt-assertion"]',
      'req.headers["cf-access-authenticated-user-email"]',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
} satisfies LoggerOptions;

const rootLogger = pino(loggerOptions);

export function createLogger(name: string) {
  return rootLogger.child({ name });
}

export { rootLogger };
