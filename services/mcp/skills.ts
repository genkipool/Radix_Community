/**
 * services/mcp/skills.ts
 *
 * Generates the downloadable SKILL.md file for AI agents. The tool reference
 * is generated from the live registry, so it can never drift from the code.
 */

import { z } from 'zod';
import { getMcpRegistry } from './tools';
import { MCP_SERVER_INFO } from './protocol';
import type { McpToolCategory, McpToolDefinition } from './types';

const CATEGORY_TITLES: Record<McpToolCategory, string> = {
  site: 'Site navigation',
  knowledge: 'Documentation & knowledge',
  ledger: 'Ledger (on-chain data)',
  console: 'Console (transactions & developer utilities)',
};

interface JsonSchemaObject {
  properties?: Record<string, { type?: string; description?: string; default?: unknown; enum?: unknown[] }>;
  required?: string[];
}

function parameterLines(tool: McpToolDefinition): string {
  const schema = z.toJSONSchema(tool.inputSchema) as JsonSchemaObject;
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const keys = Object.keys(properties);
  if (keys.length === 0) return '_No parameters._';

  return keys
    .map((key) => {
      const prop = properties[key];
      const type = prop.enum ? prop.enum.map((v) => `"${v}"`).join(' | ') : (prop.type ?? 'any');
      const flags = [
        required.has(key) ? 'required' : 'optional',
        prop.default !== undefined ? `default: ${JSON.stringify(prop.default)}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      return `- \`${key}\` (${type}; ${flags}) — ${prop.description ?? ''}`.trimEnd();
    })
    .join('\n');
}

function toolSection(tool: McpToolDefinition): string {
  return [`### \`${tool.name}\` — ${tool.title}`, '', tool.description, '', parameterLines(tool)].join('\n');
}

/**
 * Renders the full skill file. `origin` is the deployment origin
 * (e.g. https://radix.community) used in every URL of the document.
 */
export function generateSkillMarkdown(origin: string): string {
  const tools = getMcpRegistry().list();
  const byCategory = (category: McpToolCategory) =>
    tools.filter((tool) => tool.category === category);

  const toolReference = (Object.keys(CATEGORY_TITLES) as McpToolCategory[])
    .map((category) =>
      [`## ${CATEGORY_TITLES[category]}`, '', byCategory(category).map(toolSection).join('\n\n')].join('\n'),
    )
    .join('\n\n');

  return `---
name: radix-community-web
description: Use the Radix Community MCP server to answer questions about the Radix DLT network from the site docs, inspect any on-ledger entity (accounts, components, packages, resources, validators, transactions), and prepare transaction manifests the user signs in the web console with their Radix wallet.
---

# Radix Community Web — MCP skill

MCP server of ${origin} (server name: \`${MCP_SERVER_INFO.name}\`, version ${MCP_SERVER_INFO.version}).

## Connection

Streamable HTTP endpoint (stateless, no authentication):

\`\`\`
${origin}/api/mcp
\`\`\`

Example (Claude Code): \`claude mcp add --transport http radix ${origin}/api/mcp\`

Generic JSON client config:

\`\`\`json
{
  "mcpServers": {
    "radix": { "type": "http", "url": "${origin}/api/mcp" }
  }
}
\`\`\`

## How to work with this server

1. **Site questions** ("where is X?", "what does this site offer?") → \`get_site_overview\`.
2. **Knowledge questions** ("how do NFTs work on Radix?", "where is the validator install guide?") → \`search_radix_docs\`, then \`read_radix_doc\` for the full text. Both accept \`locale: "en" | "es"\` — answer in the user's language.
3. **On-ledger data** (balances, entity state, transactions, validators, NFTs, holders, component state, blueprints) → the ledger tools. All accept \`network: "mainnet" | "stokenet"\`; default is mainnet. Never mix networks: mainnet addresses contain \`_rdx1\`, stokenet ones \`_tdx_2_1\` (\`inspect_address\` tells you which network an address belongs to).
4. **Actions** (send tokens, stake, create a token, deploy, …): MCP **cannot sign transactions**. The safe pipeline is: build the manifest (console tools) → \`validate_transaction_manifest\` → \`preview_transaction\` (real fees and balance changes, no signature) → \`explain_manifest\` so the user understands it → send the user to \`${origin}/{locale}/console/transaction-manifest\` to paste and sign it with their Radix wallet.

## Output format

Every tool returns pre-formatted plain text (banner, aligned key/value rows,
tables, fenced code blocks, and a "Next steps" section). It is designed to be
read as-is — quote it or summarise it for the user, do not re-parse it as data.

## Typical workflows

- *"How do NFTs work on Radix?"* → \`search_radix_docs {"query": "NFT"}\` → \`read_radix_doc\` → answer with doc URL.
- *"Where is the validator installation guide?"* → \`search_radix_docs {"query": "validator node"}\` → share the URL from the result.
- *"What does account_rdx1… hold?"* → \`get_account_balances\`.
- *"Send 10 XRD to Bob"* → \`build_manifest_from_template {"templateId": "transfer-tokens", "values": {…}}\` → \`preview_transaction\` → user signs in the console.
- *"Create a token called Foo"* → \`build_fungible_token_manifest\` → \`preview_transaction\` → user signs in the console.
- *"Which validator should I stake with?"* → \`list_validators\` → compare fee/uptime/APY → staking page ${origin}/en/console/staking.
- *"What is this manifest going to do?"* → \`explain_manifest\` (plain-language steps) + \`preview_transaction\` (fees, balance changes).
- *"What's the XRD price / network status?"* → \`get_xrd_price\`, \`get_network_status\`.
- *"Who holds token X? What NFTs exist in collection Y?"* → \`get_resource_holders\`, \`get_nft_data\`.
- *"What methods does component_rdx1… expose? What's in its state?"* → \`get_component_blueprint\`, \`get_component_state\`, \`get_key_value_store\`.

# Tool reference

${toolReference}
`;
}
