/**
 * services/mcp/tools/index.ts
 *
 * Assembles the complete MCP tool registry. Add new tool modules here.
 */

import { McpToolRegistry } from '../registry';
import { searchRadixDocsTool, readRadixDocTool } from './docs';
import { ledgerTools } from './ledger';
import { consoleTools } from './console';
import { validatorTools } from './validator';
import { poolTools } from './pool';
import { distributionTools } from './distribution';
import { depositTools } from './deposits';
import { signTools } from './sign';
import { connectorTools } from './connector';
import { walletTools } from './wallet';
import { siteTools } from './site';

export const knowledgeTools = [searchRadixDocsTool, readRadixDocTool];

let registry: McpToolRegistry | null = null;

/** Lazily-built singleton registry with every MCP tool of the site. */
export function getMcpRegistry(): McpToolRegistry {
  registry ??= new McpToolRegistry([
    ...siteTools,
    ...knowledgeTools,
    ...ledgerTools,
    ...consoleTools,
    ...validatorTools,
    ...poolTools,
    ...distributionTools,
    ...depositTools,
    ...signTools,
    ...connectorTools,
    ...walletTools,
  ]);
  return registry;
}
