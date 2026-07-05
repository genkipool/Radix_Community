/**
 * services/mcp/tools/index.ts
 *
 * Assembles the complete MCP tool registry. Add new tool modules here.
 */

import { McpToolRegistry } from '../registry';
import { searchRadixDocsTool, readRadixDocTool } from './docs';
import { ledgerTools } from './ledger';
import { consoleTools } from './console';
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
  ]);
  return registry;
}
