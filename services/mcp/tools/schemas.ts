/** Input schemas the MCP tools share, so every tool describes them the same way. */
import { z } from 'zod';

export const networkSchema = z
  .enum(['mainnet', 'stokenet'])
  .default('mainnet')
  .describe('Radix network: "mainnet" (production) or "stokenet" (testnet)');

export const localeSchema = z.enum(['en', 'es']).default('en').describe('Language of the console links: "en" or "es"');
