/**
 * services/mcp/registry.ts
 *
 * Tool registry: single source of truth mapping tool names to their zod
 * input schema, metadata, and handler. `tools/list`, `tools/call` and the
 * downloadable skills file are all generated from this registry.
 */

import { z } from 'zod';
import type {
  McpToolContext,
  McpToolDefinition,
  McpToolJson,
  McpToolResult,
} from './types';

/** Identity helper that preserves the schema type for the handler input. */
export function defineMcpTool<Schema extends z.ZodTypeAny>(
  tool: McpToolDefinition<Schema>,
): McpToolDefinition<z.ZodTypeAny> {
  return tool as unknown as McpToolDefinition<z.ZodTypeAny>;
}

export class McpToolRegistry {
  private readonly tools = new Map<string, McpToolDefinition>();

  constructor(tools: McpToolDefinition[]) {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        throw new Error(`Duplicate MCP tool name: ${tool.name}`);
      }
      this.tools.set(tool.name, tool);
    }
  }

  list(): McpToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Wire format for the `tools/list` response. */
  listJson(): McpToolJson[] {
    return this.list().map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
      annotations: { readOnlyHint: tool.readOnly !== false },
    }));
  }

  /** Executes a tool. Never throws — failures become `isError` results. */
  async call(name: string, args: unknown, ctx: McpToolContext): Promise<McpToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return errorResult(`Unknown tool "${name}". Call tools/list to see the available tools.`);
    }

    const parsed = tool.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `• ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
      return errorResult(`Invalid arguments for "${name}":\n${issues}`);
    }

    try {
      const out = await tool.handler(parsed.data, ctx);
      if (typeof out === 'string') {
        return { content: [{ type: 'text', text: out }] };
      }
      return {
        content: [{ type: 'text', text: out.text }],
        ...(out.structured ? { structuredContent: out.structured } : {}),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Tool "${name}" failed: ${message}`);
    }
  }
}

function errorResult(text: string): McpToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}
