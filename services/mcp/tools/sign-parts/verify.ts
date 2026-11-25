/**
 * MCP tools for verifying Radix Seal certificates and checking on-ledger
 * signing requests.
 */
import { z } from 'zod';
import {
  DOC_HASH_HEX_RE,
  networkIdFromName,
  networkNameForId,
} from '@/features/sign/lib/network';
import { getOnChainRequestStatus } from '@/features/sign/lib/onchain-status.server';
import {
  verifyBodySchema,
  verifyCertificateEnvelope,
} from '@/features/sign/lib/verify.server';
import {
  cliBanner,
  cliKeyValues,
  cliRender,
  cliSection,
  cliTable,
} from '../../cli';
import { defineMcpTool } from '../../registry';
import { networkSchema } from '../schemas';
import { formatDomainProof } from './network';

export const verifyDocumentSignatureTool = defineMcpTool({
  name: 'verify_document_signature',
  title: 'Verify a document-signature certificate',
  description:
    'Verifies a Radix Seal document-attestation certificate (the contents of a .radixsig.json file). Checks every signature against the shared payload — ROLA proofs and/or the on-ledger chain of custody — and reports whether the certificate is complete. It receives ONLY the certificate, never the document itself.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    certificate: z
      .string()
      .min(2)
      .max(200_000)
      .describe(
        'The certificate JSON: the full contents of the .radixsig.json file.',
      ),
  }),
  handler: async ({ certificate }, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(certificate);
    } catch {
      throw new Error('The certificate is not valid JSON.');
    }
    const envelope =
      parsed && typeof parsed === 'object' && 'envelope' in parsed
        ? (parsed as { envelope: unknown }).envelope
        : parsed;

    const validated = verifyBodySchema.safeParse({ envelope });
    if (!validated.success) {
      throw new Error('invalid_certificate');
    }

    const data = await verifyCertificateEnvelope(validated.data, {
      expectedOrigin: ctx.origin,
    });

    const net = networkNameForId(data.networkId);
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
          data.onChainValid === null
            ? 'n/a'
            : data.onChainValid
              ? 'valid'
              : 'INVALID',
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

export const checkSigningRequestTool = defineMcpTool({
  name: 'check_signing_request',
  title: 'Check a Radix Seal signing request',
  description:
    'Reads the on-ledger status of a Radix Seal signing request by its id (the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#"). Returns the required signers, who has signed, and whether the request is complete. Read-only Gateway query.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    requestId: z
      .string()
      .min(6)
      .max(600)
      .describe(
        'Request id: the first invitation NFT global id, e.g. "resource_tdx_2_1...:#25#".',
      ),
    network: networkSchema,
    docHash: z
      .string()
      .regex(DOC_HASH_HEX_RE)
      .optional()
      .describe(
        'Optional document hash (blake2b-256, 64 hex chars) to confirm the request anchors the expected file.',
      ),
  }),
  handler: async ({ requestId, network, docHash }) => {
    const data = await getOnChainRequestStatus({
      networkId: networkIdFromName(network),
      requestId,
      docHash,
    });

    if (!data.found) {
      return cliRender(
        cliBanner('Radix Seal · signing request'),
        cliKeyValues([
          ['Request id', requestId],
          ['Network', network],
          [
            'Result',
            'not found (unknown request, or its invitation batch is incomplete)',
          ],
        ]),
      );
    }

    const sigs = data.signatures;
    const signed = sigs.filter((s) => s.signed).length;
    return cliRender(
      cliBanner('Radix Seal · signing request'),
      cliKeyValues([
        ['Request id', data.requestId],
        [
          'Status',
          data.complete
            ? 'COMPLETE (all signed)'
            : `pending (${signed}/${sigs.length} signed)`,
        ],
        ['Document hash', data.docHash],
        [
          'Hash match',
          docHash
            ? data.hashMismatch
              ? 'MISMATCH (file differs from request)'
              : 'matches'
            : undefined,
        ],
        ['Collection', data.collection],
        ['Network', network],
        ['Issuer account', data.issuer?.account],
        ['Issuer org', data.issuer?.orgName],
        ['Domain proof', formatDomainProof(data.issuer?.domainVerification)],
      ]),
      cliSection('Signers'),
      cliTable(
        ['Signer', 'Signed'],
        sigs.map((s) => [s.account, s.signed ? 'yes' : 'no']),
      ),
    );
  },
});
