import { describe, it, expect } from 'vitest';
import { handleMcpBody, handleMcpMessage, MCP_SERVER_INFO } from '@/services/mcp/protocol';
import { getMcpRegistry } from '@/services/mcp/tools';
import type { JsonRpcResponse, McpToolResult } from '@/services/mcp/types';

const CTX = { origin: 'https://example.test' };
const registry = getMcpRegistry();

const rpc = (method: string, params?: Record<string, unknown>, id: number | undefined = 1) =>
  handleMcpMessage({ jsonrpc: '2.0', id, method, params }, registry, CTX);

const callTool = async (name: string, args: Record<string, unknown>) => {
  const res = (await rpc('tools/call', { name, arguments: args })) as JsonRpcResponse;
  return res.result as McpToolResult;
};

// Real address (checksum verified against the network)
const MAINNET_XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

describe('MCP protocol', () => {
  it('answers initialize with negotiated protocol version and server info', async () => {
    const res = (await rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    })) as JsonRpcResponse;

    expect(res.error).toBeUndefined();
    const result = res.result as { protocolVersion: string; serverInfo: unknown; capabilities: { tools: object } };
    expect(result.protocolVersion).toBe('2025-03-26');
    expect(result.serverInfo).toEqual(MCP_SERVER_INFO);
    expect(result.capabilities.tools).toBeDefined();
  });

  it('falls back to the latest protocol version for unknown requests', async () => {
    const res = (await rpc('initialize', { protocolVersion: '1999-01-01' })) as JsonRpcResponse;
    expect((res.result as { protocolVersion: string }).protocolVersion).toBe('2025-06-18');
  });

  it('acknowledges notifications silently', async () => {
    expect(await rpc('notifications/initialized', undefined, undefined)).toBeNull();
  });

  it('answers ping', async () => {
    expect(((await rpc('ping')) as JsonRpcResponse).result).toEqual({});
  });

  it('rejects unknown methods with -32601', async () => {
    const res = (await rpc('resources/read')) as JsonRpcResponse;
    expect(res.error?.code).toBe(-32601);
  });

  it('rejects malformed messages with -32600', async () => {
    const res = (await handleMcpBody({ hello: 'world' }, registry, CTX)) as JsonRpcResponse;
    expect(res.error?.code).toBe(-32600);
  });

  it('handles legacy batches', async () => {
    const res = (await handleMcpBody(
      [
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
      ],
      registry,
      CTX,
    )) as JsonRpcResponse[];
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(1);
  });
});

describe('MCP tools/list', () => {
  it('exposes every tool with a JSON Schema input', async () => {
    const res = (await rpc('tools/list')) as JsonRpcResponse;
    const { tools } = res.result as { tools: Array<{ name: string; description: string; inputSchema: { type: string } }> };

    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_site_overview',
        'search_radix_docs',
        'read_radix_doc',
        'lookup_entity',
        'get_account_balances',
        'get_transaction',
        'list_validators',
        'get_network_status',
        'get_xrd_price',
        'get_recent_transactions',
        'get_address_transactions',
        'get_nft_data',
        'get_resource_holders',
        'get_component_state',
        'get_key_value_store',
        'get_component_blueprint',
        'list_console_tools',
        'list_manifest_templates',
        'build_manifest_from_template',
        'build_fungible_token_manifest',
        'validate_transaction_manifest',
        'preview_transaction',
        'explain_manifest',
        'decode_sbor',
        'convert_olympia_address',
        'inspect_address',
        'get_known_addresses',
      ]),
    );
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

describe('MCP tools/call', () => {
  it('runs inspect_address offline', async () => {
    const result = await callTool('inspect_address', { address: MAINNET_XRD });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('resource');
    expect(result.content[0].text).toContain('mainnet');
  });

  it('returns isError with the validation issues for bad arguments', async () => {
    const result = await callTool('inspect_address', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('address');
  });

  it('returns isError for unknown tools', async () => {
    const result = await callTool('no_such_tool', {});
    expect(result.isError).toBe(true);
  });

  it('searches the docs in both languages and links the doc page', async () => {
    const en = await callTool('search_radix_docs', { query: 'validator', locale: 'en' });
    expect(en.isError).toBeUndefined();
    expect(en.content[0].text).toContain('https://example.test/en/docs?view=');

    const es = await callTool('search_radix_docs', { query: 'validador', locale: 'es' });
    expect(es.isError).toBeUndefined();
    expect(es.content[0].text).toContain('/es/docs?view=');
  });

  it('reads a full doc as markdown', async () => {
    const result = await callTool('read_radix_doc', { docId: 'scrypto-basics', locale: 'en' });
    expect(result.content[0].text).toContain('#');
    expect(result.content[0].text).toContain('scrypto-basics');
  });

  it('lists the console tools with their URLs', async () => {
    const result = await callTool('list_console_tools', { locale: 'es' });
    expect(result.content[0].text).toContain('https://example.test/es/console/send-transaction');
  });

  it('renders the site overview in the requested language', async () => {
    const result = await callTool('get_site_overview', { locale: 'es' });
    expect(result.content[0].text).toContain('Consola de Desarrollo');
    expect(result.content[0].text).toContain('https://example.test/es/console');
  });

  it('explains a manifest step by step in the requested language', async () => {
    const manifest = `
CALL_METHOD
    Address("account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw")
    "withdraw"
    Address("${MAINNET_XRD}")
    Decimal("10")
;
CALL_METHOD
    Address("account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;`;
    const en = await callTool('explain_manifest', { manifest, locale: 'en' });
    expect(en.isError).toBeUndefined();
    expect(en.content[0].text).toContain('2 step(s)');
    expect(en.content[0].text).toContain('Withdrawal');

    const es = await callTool('explain_manifest', { manifest, locale: 'es' });
    expect(es.content[0].text).toContain('Retirada');
  });

  it('rejects non-hex input for decode_sbor', async () => {
    const result = await callTool('decode_sbor', { hex: 'not-hex!' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('hex');
  });
});
