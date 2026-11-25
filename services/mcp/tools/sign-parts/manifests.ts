/**
 * MCP tool for building and statically validating Radix Seal registry and
 * document signing transaction manifests.
 */
import { z } from 'zod';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { SEAL_IMAGE_URL, radixSealAddress } from '@/features/sign/constants/seal';
import { getSealAccountState } from '@/features/sign/lib/collection-audit.server';
import {
  DOC_HASH_HEX_RE,
  RADIX_ACCOUNT_RE,
  RADIX_RESOURCE_RE,
  networkMatchesAccount,
  networkMatchesCollection,
  splitNftGlobalId,
} from '@/features/sign/lib/network';
import {
  entityDetails,
  fetchLedgerTimestampNow,
  sealFromOwnerRule,
} from '@/features/sign/lib/onchain-custody';
import {
  buildRadixSealDeployManifest,
  buildSealMintManifest,
} from '@/features/sign/lib/radix-seal-manifest';
import { parseRequestKey } from '@/features/sign/lib/share';
import {
  MAX_COLLECTION_META_FIELDS,
  buildCollectionMetadataManifest,
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureOrFirstCollectionManifest,
  requestKey as formatRequestKey,
  resolveRequestSigners,
} from '@/features/sign/lib/sign-request';
import { staticallyValidateManifest } from '@/services/ret';
import {
  cliBanner,
  cliCode,
  cliKeyValues,
  cliNext,
  cliRender,
  cliSection,
} from '../../cli';
import {
  RADIX_COMMUNITY_ORIGIN,
  dappDefinitionFor,
  signingSteps,
} from '../../dapp';
import { defineMcpTool } from '../../registry';
import { localeSchema } from '../schemas';
import { resolveSealNetwork } from './network';

const customMetaSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().min(1).max(256),
  locked: z.boolean().default(false),
});

export const buildSealManifestTool = defineMcpTool({
  name: 'build_seal_manifest',
  title: 'Build a Radix Seal registry or signing manifest',
  description:
    'Builds and statically validates a ready-to-sign Radix transaction manifest for Radix Seal registry and signing operations: "deploy_brand" (one-time global Seal resource), "mint_seal" (self-mint soulbound Seal), "create_collection" (company/personal signing collection), "update_identity" (edit orgName/orgUrl/name/symbol/logo), "create_request" (multi-party document invitation batch), or "sign_document" (solo or co-signer signature NFT — automatically creates the signing collection inline with first signature #1# when the account holds a Seal but no collection yet, matching the Web UI). Enforces strict Mainnet/Stokenet address isolation and never adds lock_fee.',
  category: 'console',
  readOnly: false,
  inputSchema: z.object({
    operation: z
      .enum([
        'deploy_brand',
        'mint_seal',
        'create_collection',
        'update_identity',
        'create_request',
        'sign_document',
      ])
      .describe('Which Radix Seal registry or signing operation to build.'),
    account: z
      .string()
      .regex(RADIX_ACCOUNT_RE)
      .optional()
      .describe(
        'Acting Radix account address (required for all operations except deploy_brand).',
      ),
    network: z
      .enum(['mainnet', 'stokenet'])
      .optional()
      .describe(
        'Target network ("mainnet" or "stokenet"); auto-detected from account/collection when omitted, or verified to match.',
      ),
    sealResource: z
      .string()
      .regex(RADIX_RESOURCE_RE)
      .optional()
      .describe(
        'Radix Seal brand resource address (defaults to NEXT_PUBLIC_RADIX_SEAL_MAINNET / _STOKENET).',
      ),
    sealGlobalId: z
      .string()
      .max(300)
      .optional()
      .describe(
        'Owner Seal NFT global id ("resource_…:{ruid}"). Auto-resolved from the account/collection when omitted.',
      ),
    collection: z
      .string()
      .regex(RADIX_RESOURCE_RE)
      .optional()
      .describe(
        'Signing collection address. Auto-resolved to the account active collection when omitted for create_request / sign_document.',
      ),
    name: z
      .string()
      .max(120)
      .optional()
      .describe(
        'Collection display name (create_collection / update_identity).',
      ),
    symbol: z
      .string()
      .max(12)
      .optional()
      .describe('Short uppercase resource symbol, up to 5 chars.'),
    orgName: z
      .string()
      .max(200)
      .optional()
      .describe(
        'Formal organisation/institution name (create_collection / update_identity).',
      ),
    orgUrl: z
      .string()
      .max(300)
      .optional()
      .describe(
        'Organisation website URL (create_collection / update_identity).',
      ),
    logoUrl: z
      .string()
      .max(500)
      .optional()
      .describe('Logo / icon URL for the Seal or collection.'),
    adminBadge: z
      .string()
      .max(300)
      .optional()
      .describe(
        'Optional admin badge resource/NFT global id for deploy_brand.',
      ),
    customMetadata: z
      .array(customMetaSchema)
      .max(MAX_COLLECTION_META_FIELDS)
      .optional()
      .describe(
        'Optional custom metadata entries written at collection creation (e.g. department, tax_id).',
      ),
    docHash: z
      .string()
      .regex(DOC_HASH_HEX_RE)
      .optional()
      .describe(
        'BLAKE2b-256 document hash (64 lowercase hex chars) for create_request / sign_document.',
      ),
    requiredSigners: z
      .array(z.string().regex(RADIX_ACCOUNT_RE))
      .min(1)
      .max(25)
      .optional()
      .describe(
        'Required signer account addresses (same network!) for create_request.',
      ),
    alsoSign: z
      .boolean()
      .default(true)
      .describe(
        'For create_request: whether the initiator also mints their own signature NFT in the same transaction.',
      ),
    request: z
      .string()
      .max(600)
      .optional()
      .describe(
        'For sign_document: optional request key ("resource_…:#firstId#") being answered; omit for solo signature.',
      ),
    locale: localeSchema,
  }),
  handler: async (args, ctx) => {
    const { networkId, network } = resolveSealNetwork({
      network: args.network,
      account: args.account,
      collection: args.collection,
      sealResource: args.sealResource,
      fallback: RadixNetworkId.Mainnet,
    });
    const netEnum = network;

    const effectiveSealResource = (
      args.sealResource?.trim() || radixSealAddress(networkId)
    ).trim();

    let manifest: string;
    const summaryRows: Array<[string, string | undefined]> = [
      ['Operation', args.operation],
      ['Network', network],
    ];

    if (args.operation === 'deploy_brand') {
      if (args.adminBadge) {
        const badgeRes = splitNftGlobalId(args.adminBadge).resource;
        if (!networkMatchesCollection(networkId, badgeRes)) {
          throw new Error(
            `Network mismatch: adminBadge "${args.adminBadge}" is not on ${network}.`,
          );
        }
      }
      manifest = buildRadixSealDeployManifest({
        imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
        origin: RADIX_COMMUNITY_ORIGIN,
        dAppDefinition: dappDefinitionFor(netEnum) || undefined,
        adminBadge: args.adminBadge,
        symbol: args.symbol,
      });
      summaryRows.push(['Symbol', args.symbol || 'SEAL']);
    } else {
      if (!args.account) {
        throw new Error(
          `"account" is required for operation "${args.operation}".`,
        );
      }
      const account = args.account;

      if (args.operation === 'mint_seal') {
        if (!effectiveSealResource) {
          throw new Error(
            `No Radix Seal brand resource configured for ${network}. Deploy one first with operation "deploy_brand" or pass "sealResource".`,
          );
        }
        manifest = buildSealMintManifest({
          account,
          sealResource: effectiveSealResource,
          imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
        });
        summaryRows.push(
          ['Account', account],
          ['Seal brand', effectiveSealResource],
        );
      } else if (args.operation === 'create_collection') {
        let sealGlobalId = args.sealGlobalId?.trim() || '';
        if (!sealGlobalId) {
          const state = await getSealAccountState(
            networkId,
            account,
            effectiveSealResource || undefined,
          );
          sealGlobalId = state.seals[0]?.globalId ?? '';
        }
        if (!sealGlobalId) {
          throw new Error(
            `Account "${account}" holds no Radix Seal NFT yet. Run operation "mint_seal" first (or pass "sealGlobalId").`,
          );
        }
        const sealAddr =
          effectiveSealResource || splitNftGlobalId(sealGlobalId).resource;
        if (!networkMatchesCollection(networkId, sealAddr)) {
          throw new Error(
            `Network mismatch: sealGlobalId "${sealGlobalId}" is not on ${network}.`,
          );
        }
        const issuer =
          args.orgName || args.orgUrl || args.logoUrl
            ? {
                orgName: args.orgName?.trim() || undefined,
                orgWebsite: args.orgUrl?.trim() || undefined,
                orgLogoUrl: args.logoUrl?.trim() || undefined,
              }
            : undefined;
        manifest = buildSignCollectionCreateManifest({
          account,
          sealGlobalId,
          sealAddress: sealAddr,
          networkId,
          collectionName: args.name?.trim() || args.orgName?.trim() || '',
          symbol: args.symbol,
          imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
          issuer,
          extraMetadata: args.customMetadata,
        });
        summaryRows.push(
          ['Account', account],
          ['Owner Seal', sealGlobalId],
          ['Name', args.name || args.orgName || '(default)'],
        );
      } else if (args.operation === 'update_identity') {
        if (!args.collection) {
          throw new Error(
            '"collection" is required for operation "update_identity".',
          );
        }
        let sealGlobalId = args.sealGlobalId?.trim() || '';
        if (!sealGlobalId) {
          const [colItem] = await entityDetails(netEnum, [args.collection]);
          const owner = sealFromOwnerRule(colItem);
          if (owner) sealGlobalId = `${owner.resource}:${owner.localId}`;
        }
        if (!sealGlobalId) {
          throw new Error(
            `Could not resolve the owner Seal NFT for collection "${args.collection}".`,
          );
        }
        manifest = buildCollectionMetadataManifest({
          account,
          sealGlobalId,
          collection: args.collection,
          name: args.name,
          symbol: args.symbol,
          iconUrl: args.logoUrl,
          orgName: args.orgName,
          orgUrl: args.orgUrl,
        });
        if (!manifest.trim()) {
          throw new Error(
            'Provide at least one field to update (name, symbol, orgName, orgUrl, logoUrl).',
          );
        }
        summaryRows.push(
          ['Account', account],
          ['Collection', args.collection],
          ['Owner Seal', sealGlobalId],
        );
      } else {
        if (!args.docHash) {
          throw new Error(
            `"docHash" (64-hex BLAKE2b-256) is required for "${args.operation}".`,
          );
        }
        if (args.operation === 'create_request') {
          if (!args.requiredSigners?.length) {
            throw new Error('"requiredSigners" is required for "create_request".');
          }
          for (const signer of args.requiredSigners) {
            if (!networkMatchesAccount(networkId, signer)) {
              throw new Error(
                `Network mismatch: required signer "${signer}" is not on ${network}.`,
              );
            }
          }
        }
        let normalizedRequest = '';
        if (args.operation === 'sign_document' && args.request?.trim()) {
          const parsedReq = parseRequestKey(args.request);
          if (!parsedReq) {
            throw new Error(
              `Invalid request key "${args.request}". Expected "resource_…:#id#".`,
            );
          }
          if (!networkMatchesCollection(networkId, parsedReq.collection)) {
            throw new Error(
              `Network mismatch: request "${args.request}" is not on ${network}.`,
            );
          }
          normalizedRequest = formatRequestKey(
            parsedReq.collection,
            Number(parsedReq.id),
          );
        }

        const state = await getSealAccountState(
          networkId,
          account,
          effectiveSealResource || undefined,
          args.collection ? [args.collection] : undefined,
        );
        const colInfo = args.collection
          ? state.collections.find((c) => c.resourceAddress === args.collection)
          : state.collections[0];
        if (!colInfo && (args.collection || args.operation === 'create_request')) {
          throw new Error(
            args.collection
              ? `Collection "${args.collection}" was not found as a Seal-owned signing collection of "${account}".`
              : `Account "${account}" has no Seal-owned signing collection yet. Run operation "create_collection" first.`,
          );
        }
        const sealGlobalId =
          args.sealGlobalId?.trim() ||
          colInfo?.ownerSealGlobalId ||
          state.seals[0]?.globalId ||
          '';
        if (!sealGlobalId) {
          throw new Error(
            colInfo
              ? `Could not resolve owner Seal NFT for "${colInfo.resourceAddress}".`
              : `Account "${account}" holds no Radix Seal NFT yet. Run operation "mint_seal" first (or pass "sealGlobalId").`,
          );
        }
        const sealAddr =
          effectiveSealResource || splitNftGlobalId(sealGlobalId).resource;
        if (!networkMatchesCollection(networkId, sealAddr)) {
          throw new Error(
            `Network mismatch: sealGlobalId "${sealGlobalId}" is not on ${network}.`,
          );
        }
        const issuedAt = await fetchLedgerTimestampNow(netEnum);

        if (args.operation === 'create_request') {
          const effectiveSigners = resolveRequestSigners(
            account,
            args.requiredSigners!,
            args.alsoSign,
          );
          manifest = buildSignRequestManifest({
            account,
            sealGlobalId,
            collection: colInfo!.resourceAddress,
            nextId: colInfo!.nextId,
            docHash: args.docHash,
            networkId,
            requiredSigners: effectiveSigners,
            alsoSign: args.alsoSign,
            imageUrl: SEAL_IMAGE_URL,
            issuedAt,
          });
          summaryRows.push(
            ['Account', account],
            ['Collection', colInfo!.resourceAddress],
            [
              'Request key',
              formatRequestKey(colInfo!.resourceAddress, colInfo!.nextId),
            ],
            ['Required signers', String(effectiveSigners.length)],
          );
        } else {
          const issuer =
            !colInfo && (args.orgName || args.orgUrl || args.logoUrl)
              ? {
                  orgName: args.orgName?.trim() || undefined,
                  orgWebsite: args.orgUrl?.trim() || undefined,
                  orgLogoUrl: args.logoUrl?.trim() || undefined,
                }
              : undefined;
          manifest = buildSignatureOrFirstCollectionManifest({
            account,
            sealGlobalId,
            sealAddress: sealAddr,
            collection: colInfo?.resourceAddress ?? null,
            nextId: colInfo?.nextId,
            docHash: args.docHash,
            networkId,
            request: normalizedRequest,
            imageUrl: args.logoUrl?.trim() || SEAL_IMAGE_URL,
            issuedAt,
            collectionName: args.name?.trim() || args.orgName?.trim() || '',
            symbol: args.symbol,
            issuer,
            extraMetadata: args.customMetadata,
          });
          summaryRows.push(
            ['Account', account],
            [
              'Collection',
              colInfo
                ? colInfo.resourceAddress
                : '(created inline with first signature #1#)',
            ],
            [
              'Signature NFT',
              colInfo
                ? formatRequestKey(colInfo.resourceAddress, colInfo.nextId)
                : '#1# (in newly created collection)',
            ],
            ['Request', normalizedRequest || '(solo signature)'],
          );
        }
      }
    }

    const validation = await staticallyValidateManifest(manifest, netEnum);

    return cliRender(
      cliBanner(`Radix Seal · ${args.operation} (${network})`),
      cliKeyValues(summaryRows),
      cliSection('Transaction manifest'),
      cliCode(manifest, 'rtm'),
      cliNext(signingSteps(ctx.origin, netEnum, args.locale, validation)),
    );
  },
});
