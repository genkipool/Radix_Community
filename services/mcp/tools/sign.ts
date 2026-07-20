/**
 * services/mcp/tools/sign.ts
 *
 * Radix Seal signing tools for the MCP. Both are thin clients of the existing
 * verification endpoints (`/api/sign/verify`, `/api/sign/onchain-status`), so
 * the security-sensitive verification logic stays in ONE place and the MCP
 * never duplicates it. They are read-only from the caller's point of view (no
 * wallet, no transaction): one verifies a certificate, the other reads the
 * on-ledger state of a request.
 */

import { z } from 'zod';
import { defineMcpTool } from '../registry';
import { cliBanner, cliKeyValues, cliRender, cliSection, cliTable } from '../cli';
import type { McpToolContext } from '../types';
import { RadixNetworkId } from '@/features/wallet/constants/network';

const networkSchema = z
  .enum(['mainnet', 'stokenet'])
  .default('mainnet')
  .describe('Radix network: "mainnet" (production) or "stokenet" (testnet)');

function toNetworkId(network: 'mainnet' | 'stokenet'): number {
  return network === 'mainnet' ? RadixNetworkId.Mainnet : RadixNetworkId.Stokenet;
}

/** Origin used for the internal self-call. The verify route requires
 *  NEXT_PUBLIC_APP_URL, so it is set on every deployment; ctx.origin is the
 *  fallback for local/dev where it may differ. */
function apiBase(ctx: McpToolContext): string {
  return process.env.NEXT_PUBLIC_APP_URL || ctx.origin;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new Error(json?.error || `request_failed_${res.status}`);
  }
  if (!json) throw new Error('empty_response');
  return json;
}

interface VerifyResponse {
  signatures: Array<{
    signerAccount: string;
    disclosedName: string | null;
    disclosedEmail: string | null;
    signedAt: string;
    valid: boolean;
    required: boolean;
  }>;
  requiredSigners: string[];
  allValid: boolean;
  complete: boolean;
  message: string;
  timestamp: string;
  networkId: number;
  docHash: string;
  onChainValid: boolean | null;
  sealValid: boolean | null;
}

export const verifyDocumentSignatureTool = defineMcpTool({
  name: 'verify_document_signature',
  title: 'Verify a document-signature certificate',
  description:
    'Verifies a Radix Seal document-attestation certificate (the contents of a .radixsig.json file). Checks every signature against the shared payload — ROLA proofs and/or the on-ledger chain of custody — and reports whether the certificate is complete. It receives ONLY the certificate, never the document itself.',
  category: 'console',
  inputSchema: z.object({
    certificate: z
      .string()
      .min(2)
      .max(200_000)
      .describe('The certificate JSON: the full contents of the .radixsig.json file.'),
  }),
  handler: async ({ certificate }, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(certificate);
    } catch {
      throw new Error('The certificate is not valid JSON.');
    }
    // The file is the envelope itself; tolerate a { envelope } wrapper too.
    const envelope =
      parsed && typeof parsed === 'object' && 'envelope' in parsed
        ? (parsed as { envelope: unknown }).envelope
        : parsed;

    const data = await postJson<VerifyResponse>(`${apiBase(ctx)}/api/sign/verify`, {
      envelope,
    });

    const net = data.networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
    const status = data.complete
      ? 'COMPLETE: all required signers valid'
      : data.allValid
        ? 'valid, but incomplete (missing required signers)'
        : 'INVALID: one or more signatures failed';

    return cliRender(
      cliBanner('Radix Seal · verify certificate'),
      cliKeyValues([
        ['Status', status],
        ['Document hash', data.docHash],
        ['Message', data.message || undefined],
        ['Signed at', data.timestamp],
        ['Network', net],
        [
          'Required signers',
          data.requiredSigners.length
            ? String(data.requiredSigners.length)
            : 'open set (any valid signer)',
        ],
        [
          'On-ledger custody',
          data.onChainValid === null ? 'n/a' : data.onChainValid ? 'valid' : 'INVALID',
        ],
        [
          'Official Seal insignia',
          data.sealValid === null ? 'n/a' : data.sealValid ? 'valid' : 'INVALID',
        ],
      ]),
      cliSection('Signatures'),
      cliTable(
        ['Signer', 'Valid', 'Required', 'Name', 'Signed at'],
        data.signatures.map((s) => [
          s.signerAccount,
          s.valid ? 'yes' : 'NO',
          s.required ? 'yes' : 'no',
          s.disclosedName ?? '(none)',
          s.signedAt,
        ]),
      ),
    );
  },
});

interface StatusResponse {
  found: boolean;
  requestId?: string;
  collection?: string;
  docHash?: string;
  hashMismatch?: boolean;
  networkId?: number;
  requiredSigners?: string[];
  signatures?: Array<{ account: string; signed: boolean }>;
  complete?: boolean;
  issuer?: {
    account?: string;
    collectionName?: string;
    orgName?: string;
    orgWebsite?: string;
    orgLogoUrl?: string;
  };
}

export const checkSigningRequestTool = defineMcpTool({
  name: 'check_signing_request',
  title: 'Check a Radix Seal signing request',
  description:
    'Reads the on-ledger status of a Radix Seal signing request by its id (the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#"). Returns the required signers, who has signed, and whether the request is complete. Read-only Gateway query.',
  category: 'console',
  inputSchema: z.object({
    requestId: z
      .string()
      .min(6)
      .max(600)
      .describe('Request id: the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#".'),
    network: networkSchema,
    docHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional()
      .describe('Optional document hash (blake2b-256, 64 hex chars) to confirm the request anchors the expected file.'),
  }),
  handler: async ({ requestId, network, docHash }, ctx) => {
    const data = await postJson<StatusResponse>(`${apiBase(ctx)}/api/sign/onchain-status`, {
      networkId: toNetworkId(network),
      requestId,
      docHash,
    });

    if (!data.found) {
      return cliRender(
        cliBanner('Radix Seal · signing request'),
        cliKeyValues([
          ['Request id', requestId],
          ['Network', network],
          ['Result', 'not found (unknown request, or its invitation batch is incomplete)'],
        ]),
      );
    }

    const sigs = data.signatures ?? [];
    const signed = sigs.filter((s) => s.signed).length;
    return cliRender(
      cliBanner('Radix Seal · signing request'),
      cliKeyValues([
        ['Request id', data.requestId],
        [
          'Status',
          data.complete ? 'COMPLETE (all signed)' : `pending (${signed}/${sigs.length} signed)`,
        ],
        ['Document hash', data.docHash],
        [
          'Hash match',
          docHash ? (data.hashMismatch ? 'MISMATCH (file differs from request)' : 'matches') : undefined,
        ],
        ['Collection', data.collection],
        ['Network', network],
        ['Issuer account', data.issuer?.account],
        ['Issuer org', data.issuer?.orgName],
      ]),
      cliSection('Signers'),
      cliTable(
        ['Signer', 'Signed'],
        sigs.map((s) => [s.account, s.signed ? 'yes' : 'no']),
      ),
    );
  },
});

export const signTools = [verifyDocumentSignatureTool, checkSigningRequestTool];
