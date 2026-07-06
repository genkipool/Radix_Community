/**
 * services/mcp/tools/connector.ts
 *
 * `setup_wallet_connector` — the bridge tool. This HTTP MCP server (on Vercel)
 * is stateless and CANNOT sign transactions: signing needs a live Radix Connect
 * (WebRTC) channel to the user's phone, held open on the user's machine. That job
 * belongs to a separate LOCAL MCP server, `radix-connector-mcp` (a Rust binary
 * from the SDK). This tool tells an agent exactly how to install it from GitHub,
 * register it, pair a wallet and sign — so an agent that only knows this server
 * can bootstrap the ability to sign.
 */

import { z } from 'zod';
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import { defineMcpTool } from '../registry';
import { cliBanner, cliCode, cliRender, cliSection } from '../cli';

/** Public SDK repo that hosts the connector binary + install scripts. */
const REPO = 'genkipool/radixdlt-rust-sdk';
const REPO_URL = `https://github.com/${REPO}`;
const RAW = `https://raw.githubusercontent.com/${REPO}/main/scripts`;

const clientSchema = z
  .enum(['claude-code', 'claude-desktop', 'cursor', 'antigravity', 'generic'])
  .default('generic')
  .describe('Which MCP client the user runs, so the registration snippet matches it.');

const osSchema = z
  .enum(['linux', 'macos', 'windows'])
  .optional()
  .describe('User OS, to show the matching prebuilt-binary installer. Omit to show all.');

/** Prebuilt-binary install command for an OS (no Rust toolchain needed). */
function prebuiltInstall(os: 'linux' | 'macos' | 'windows'): string {
  if (os === 'windows') {
    return `irm ${RAW}/install-connector.ps1 | iex`;
  }
  return `curl -fsSL ${RAW}/install-connector.sh | sh`;
}

/** MCP registration snippet for a given client. */
function registration(client: z.infer<typeof clientSchema>): string {
  if (client === 'claude-code') {
    return cliCode('claude mcp add radix-connector -- radix-connector-mcp', 'sh');
  }
  // Claude Desktop / Cursor / Antigravity / generic all take a JSON config.
  return cliCode(
    JSON.stringify(
      { mcpServers: { 'radix-connector': { command: 'radix-connector-mcp' } } },
      null,
      2,
    ),
    'json',
  );
}

export const setupWalletConnectorTool = defineMcpTool({
  name: 'setup_wallet_connector',
  title: 'Set up local wallet signing',
  description:
    'Explains how to install and use the LOCAL Radix signing connector (radix-connector-mcp) so the user can sign and submit transactions with their Radix Wallet. This HTTP server cannot sign (it is stateless); the local connector holds the wallet channel and the phone approves. Call this when the user wants to send/sign a transaction, stake, create a token, deploy, or log in with Radix.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({ client: clientSchema, os: osSchema }),
  handler: ({ client, os }, ctx) => {
    const oses: Array<'linux' | 'macos' | 'windows'> = os
      ? [os]
      : ['linux', 'macos', 'windows'];
    const prebuilt = oses
      .map((o) => `# ${o}\n${prebuiltInstall(o)}`)
      .join('\n');

    const mainnetDapp = NETWORKS[RadixNetworkId.Mainnet].dAppDefinitionAddress;
    const stokenetDapp = NETWORKS[RadixNetworkId.Stokenet].dAppDefinitionAddress;

    return cliRender(
      cliBanner('Radix local signing connector · setup'),

      'This server prepares and previews transactions but CANNOT sign them. Signing runs\n' +
        'on the user\'s machine via a small local MCP server, "radix-connector-mcp", which\n' +
        'holds the Radix Connect channel to the phone. The private key never leaves the\n' +
        'phone; the user approves there. Install it once, then both servers work together.',

      cliSection('1. Install the connector (from GitHub)'),
      'Option A — with a Rust toolchain (any OS):',
      cliCode(`cargo install --git ${REPO_URL} radixdlt-connector-mcp`, 'sh'),
      'Option B — prebuilt binary (no Rust needed):',
      cliCode(prebuilt, 'sh'),

      cliSection('2. Register it with the MCP client'),
      registration(client),
      'If the binary is not on PATH, use its absolute path as "command"\n' +
        '(cargo installs to ~/.cargo/bin; the scripts print the exact path).',

      cliSection('3. Pair the wallet (once per device)'),
      'On the local connector, call its tools in this order:\n' +
        '  a) pair_wallet  → it returns a QR (terminal art + PNG). SHOW it to the user.\n' +
        '  b) The user scans it in the Radix Wallet app:\n' +
        '     Settings → Linked Connectors → Link New Connector.\n' +
        '  c) pair_status  → waits for the scan + approval and saves the link.',

      cliSection('4. Sign a transaction'),
      'Pipeline (this server builds, the local connector signs):\n' +
        '  1) Build + preview here: build_manifest_from_template / build_fungible_token_manifest\n' +
        '     → validate_transaction_manifest → preview_transaction → explain_manifest.\n' +
        '  2) Sign on the local connector: send_transaction { manifest, network }.\n' +
        '     The user approves on the phone. It returns the transaction intent hash.\n' +
        '  3) Confirm: transaction_status { intent_hash, network } (here or on the connector).\n' +
        '  4) ALWAYS show the transaction to the user on the custom dashboard: https://radix-community.genkipool.com/es/dashboard?network=<network>&view=transactions&tag=Success&tx=<intent_hash>',
      `Pass these when the wallet expects this dApp (origin: ${ctx.origin}):\n` +
        `  • mainnet dapp_definition:  ${mainnetDapp || '(set NEXT_PUBLIC_RADIX_DAPP_ADDRESS_MAINNET)'}\n` +
        `  • stokenet dapp_definition: ${stokenetDapp}`,

      cliSection('Security'),
      '• The phone signs; every action is approved there (human-in-the-loop).\n' +
        '• The connector stores only the channel password locally (0600 on Unix); the\n' +
        '  private key and the QR never leave the machine.\n' +
        '• Signing tools require an explicit network ("mainnet" or "stokenet") — no default.',
    );
  },
});

export const connectorTools = [setupWalletConnectorTool];
