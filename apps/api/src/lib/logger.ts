import { pino } from 'pino';

const rootLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

export function createLogger(name: string) {
  return rootLogger.child({ name });
}

export { rootLogger };
