/**
 * services/mcp/protocol.ts
 *
 * Stateless MCP (Model Context Protocol) server core — JSON-RPC 2.0 message
 * handling for the Streamable HTTP transport. Transport concerns (HTTP
 * verbs, CORS) live in app/api/mcp/route.ts; this module only understands
 * MCP messages.
 */

import {
  JSON_RPC_ERRORS,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpToolContext,
} from './types';
import type { McpToolRegistry } from './registry';

export const MCP_SERVER_INFO = {
  name: 'radix-community',
  title: 'Radix Community Web',
  version: '1.0.0',
} as const;

export const MCP_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const SERVER_INSTRUCTIONS = [
  'MCP server of the Radix Community web (docs, ledger explorer and developer console for the Radix DLT network).',
  'Use the knowledge tools to answer questions from the site documentation, the ledger tools to inspect any on-chain address (accounts, components, packages, resources, validators) or transaction, and the console tools to prepare transaction manifests the user can sign from the web console with their Radix wallet.',
  'All tool output is pre-formatted plain text designed to be read as-is. Download /api/mcp/skills for a full usage guide.',
].join(' ');

function response(id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function errorResponse(
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function isJsonRpcRequest(message: unknown): message is JsonRpcRequest {
  return (
    !!message &&
    typeof message === 'object' &&
    (message as JsonRpcRequest).jsonrpc === '2.0' &&
    typeof (message as JsonRpcRequest).method === 'string'
  );
}

/**
 * Handles one decoded JSON-RPC message.
 * Returns `null` for notifications (no response must be sent).
 */
export async function handleMcpMessage(
  message: unknown,
  registry: McpToolRegistry,
  ctx: McpToolContext,
): Promise<JsonRpcResponse | null> {
  if (!isJsonRpcRequest(message)) {
    return errorResponse(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request');
  }

  const { id, method, params } = message;
  const isNotification = id === undefined;

  // Notifications (initialized, cancelled, …) are acknowledged silently.
  if (method.startsWith('notifications/')) return null;

  switch (method) {
    case 'initialize': {
      const requested = String(params?.protocolVersion ?? '');
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : MCP_PROTOCOL_VERSION;
      return response(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: MCP_SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }

    case 'ping':
      return response(id, {});

    case 'tools/list':
      return response(id, { tools: registry.listJson() });

    case 'tools/call': {
      const name = String(params?.name ?? '');
      const result = await registry.call(name, params?.arguments, ctx);
      return response(id, result);
    }

    default:
      return isNotification
        ? null
        : errorResponse(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not supported: ${method}`);
  }
}

/**
 * Handles a raw POST body (single message or legacy batch).
 * Returns the JSON payload to send back, or `null` for 202-no-body.
 */
export async function handleMcpBody(
  body: unknown,
  registry: McpToolRegistry,
  ctx: McpToolContext,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    const responses = (
      await Promise.all(body.map((message) => handleMcpMessage(message, registry, ctx)))
    ).filter((res): res is JsonRpcResponse => res !== null);
    return responses.length > 0 ? responses : null;
  }
  return handleMcpMessage(body, registry, ctx);
}
