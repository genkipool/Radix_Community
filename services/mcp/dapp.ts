/**
 * services/mcp/dapp.ts
 *
 * Single source of truth for the dApp identity the MCP server hands to the
 * wallet when the user signs. The local `radix-connector` MCP accepts a
 * `dapp_definition` + `origin` pair on `send_transaction`,
 * `request_pre_authorization` and (mandatory) `request_account_proof`. Those
 * two values are how the Radix Wallet recognises the request as coming from a
 * verified dApp instead of showing it as "unverified" — and for ROLA login
 * they are part of the signed message, so they MUST match what the verifier
 * (and the dApp definition's on-chain metadata) expects.
 *
 * Keeping the values here means every tool that leads to a signature emits the
 * same, correct pair.
 */

import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import { networkIdFromName } from '@/services/ret';
import type { Network } from '@/services/gateway/client';

/**
 * Canonical public origin of the Radix Community site. Must match the website
 * claimed by the dApp definition on-chain, so the wallet (and ROLA) accept it.
 * Kept in lockstep with the SEO/sitemap base URL — do not point it at a
 * per-deployment preview origin, ROLA verification would fail.
 */
export const RADIX_COMMUNITY_ORIGIN = 'https://radix-community.genkipool.com';

/** dApp definition address configured for a network (may be '' if unset). */
export function dappDefinitionFor(network: Network): string {
  const id = networkIdFromName(network) as RadixNetworkId;
  return NETWORKS[id]?.dAppDefinitionAddress ?? '';
}

/** Deep link to the custom dashboard's transaction view for an intent hash. */
export function dashboardTxUrl(network: Network | string, intentHash = '<intent_hash>'): string {
  return (
    `${RADIX_COMMUNITY_ORIGIN}/es/dashboard` +
    `?network=${network}&view=transactions&tag=Success&tx=${intentHash}`
  );
}

/**
 * The exact `send_transaction` call an agent should make, with the dApp
 * definition + origin already filled in. When the dApp definition is not
 * configured for the network it returns a loud warning instead of a silently
 * empty value, so the agent does not sign as an unverified dApp by accident.
 */
export function sendTransactionSnippet(network: Network): string {
  const dappDefinition = dappDefinitionFor(network);
  if (!dappDefinition) {
    return (
      `send_transaction { manifest, network: "${network}" }\n` +
      `  ⚠ No dApp definition is configured for ${network} ` +
      `(set NEXT_PUBLIC_RADIX_DAPP_ADDRESS_${network === 'mainnet' ? 'MAINNET' : 'STOKENET'}).\n` +
      `  Without "dapp_definition" + "origin" the wallet shows the request as an UNVERIFIED dApp.`
    );
  }
  return (
    `send_transaction {\n` +
    `    manifest,\n` +
    `    network: "${network}",\n` +
    `    dapp_definition: "${dappDefinition}",\n` +
    `    origin: "${RADIX_COMMUNITY_ORIGIN}"\n` +
    `  }\n` +
    `  (dapp_definition + origin make the wallet recognise this as a verified dApp; ` +
    `they are optional for send_transaction but REQUIRED for request_account_proof / ROLA login.)`
  );
}

/**
 * Standard "how to sign this manifest" footer, shared by every tool that
 * produces a signable manifest. Threads the locale into the manual console
 * link and always surfaces the dApp definition + the post-sign confirmation.
 */
export function signingSteps(
  origin: string,
  network: Network,
  locale: 'en' | 'es',
  validation: { valid: boolean; error?: string },
): string[] {
  return [
    validation.valid
      ? 'The manifest was statically validated by the Radix Engine Toolkit — it is syntactically correct.'
      : `Static validation FAILED: ${validation.error}. Fix the inputs before signing.`,
    'ALWAYS dry-run it first with preview_transaction to see the real fee and balance changes — never ask the user to sign a manifest you have not previewed.',
    'To sign it programmatically: if the local "radix-connector" MCP server is installed, call:\n  ' +
      sendTransactionSnippet(network) +
      '\n  If it is not installed, call setup_wallet_connector for the one-time install steps.',
    `Otherwise (manual): ask the user to open ${origin}/${locale}/console/transaction-manifest, paste the manifest, and sign it with their Radix wallet.`,
    'After signing, confirm the commit with transaction_status { intent_hash, network }.',
    `Then ALWAYS show the user the transaction on the dashboard: ${dashboardTxUrl(network)}`,
  ];
}
