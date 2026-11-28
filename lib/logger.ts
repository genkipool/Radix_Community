import 'server-only';
import pino from 'pino';
import 'pino-pretty';

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
// Under vitest every test file re-evaluates this module: a pino-pretty worker per file would
// pile up process exit listeners, so tests log nothing unless LOG_LEVEL asks for it.
const inTests = Boolean(process.env.VITEST);

const logger = pino({
  level: process.env.LOG_LEVEL ?? (inTests ? 'silent' : 'info'),
  ...(process.env.NODE_ENV !== 'production' && !inTests && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});

export default logger;
