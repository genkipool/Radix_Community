import 'server-only';
import pino from 'pino';

/**
 * Structured logger powered by Pino.
 *
 * - Development: human-readable output via pino-pretty.
 * - Production:  JSON lines for log aggregation systems.
 *
 * `server-only` ensures this module is never bundled for the browser or
 * edge runtime — Next.js will throw a build-time error if any client
 * component tries to import it directly or transitively.
 *
 * Never log PII (personal identifiable information).
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});

export default logger;
