/**
 * services/mcp/types.ts
 *
 * Shared types for the Model Context Protocol (MCP) server exposed at
 * /api/mcp. Implements the tools surface of the MCP Streamable HTTP
 * transport (JSON-RPC 2.0, stateless).
 */

import type { z } from 'zod';

/* ─── JSON-RPC 2.0 ────────────────────────────────────────────────────────── */

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/* ─── MCP tool surface ────────────────────────────────────────────────────── */

/** Request-scoped context passed to every tool handler. */
export interface McpToolContext {
  /** Origin of the running deployment (e.g. https://radix.community) — used to build links. */
  origin: string;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export type McpToolCategory = 'knowledge' | 'ledger' | 'console' | 'site';

export interface McpToolDefinition<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  category: McpToolCategory;
  /** True when the tool only transforms its input (no Gateway/network calls). */
  readOnly?: boolean;
  inputSchema: Schema;
  handler: (input: z.infer<Schema>, ctx: McpToolContext) => Promise<string> | string;
}

/** Wire format of a tool as returned by `tools/list`. */
export interface McpToolJson {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
}
