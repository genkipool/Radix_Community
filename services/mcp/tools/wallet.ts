/**
 * services/mcp/tools/wallet.ts
 *
 * Wallet request tools: the MCP side of the console's wallet lab. This server
 * cannot reach the phone (the local `radix-connector` does), but it can do the
 * two halves a dApp backend owns:
 *
 * - `build_wallet_request`: the exact wallet interaction for any data, login
 *   or proof request (same builder as the web lab), plus a fresh challenge and
 *   the connector call that sends it;
 * - `verify_rola_proofs`: server-side ROLA verification of the signatures the
 *   wallet returns, with the reason for every failure.
 *
 * Together they let an agent challenge the wallet with its own challenge and
 * check the answer independently of the connector.
 */

import { z } from 'zod';
import {
  buildWalletInteraction,
  buildWalletRequestItems,
  generateRolaChallenge,
  needsChallenge,
  validateWalletRequest,
  type WalletRequestSpec,
} from '@/features/wallet/lib/wallet-interaction';
import { proofsFromWalletResponse, verifyRolaProofs, type RolaProofResult } from '@/services/rola/verify';
import { gatewayOwnerKeys } from '@/services/rola/gateway';
import { networkIdFromName } from '@/services/ret';
import { defineMcpTool } from '../registry';
import { RADIX_COMMUNITY_ORIGIN, dappDefinitionFor } from '../dapp';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection, cliTable } from '../cli';

const networkSchema = z
  .enum(['mainnet', 'stokenet'])
  .describe('Radix network: "mainnet" or "stokenet". The wallet must be on the same network.');

const quantifierSchema = z.enum(['atLeast', 'exactly']).default('atLeast');

const countSchema = z.object({
  quantity: z.number().int().min(1).max(10),
  quantifier: quantifierSchema,
});

const ISSUE_TEXT: Record<string, string> = {
  empty: 'nothing requested: ask for at least one account or persona data field',
  personaDataEmpty: 'persona_data has no field (full_name, email_addresses or phone_numbers)',
  ongoingNeedsPersona: 'ongoing accounts/data need a persona: use a login or use_persona request',
  resetNeedsPersona: 'reset needs a persona: use a login or use_persona request',
  proofNeedsPersona: 'proof_of_ownership needs auth "use_persona" with identity_address',
  proofEmpty: 'proof_of_ownership needs account_addresses or prove_identity',
  proofPersonaNeedsAccount:
    'the Android Radix Wallet loops on a proof of the persona alone ("Verify persona" never completes): add at least one account, or use auth "login" with no accounts to have only the persona sign a challenge',
  identityMissing: 'auth "use_persona" needs identity_address',
};

const AUTH_MAP = {
  none: 'none',
  login: 'loginWithChallenge',
  login_without_challenge: 'loginWithoutChallenge',
  use_persona: 'usePersona',
} as const;

const REASON_TEXT: Record<string, string> = {
  invalidChallenge: 'the challenge is not 32 bytes of hex',
  typeMismatch: 'the proof type does not match the address (account_… vs identity_…)',
  malformedProof: 'malformed public key or signature',
  invalidSignature: 'the signature does not cover this challenge + dApp definition + origin',
  keyNotInOwnerKeys: 'the key is not in the entity owner_keys',
  addressNotDerivedFromKey: 'the address is not the virtual address of the key and has no owner_keys',
  ledgerUnavailable: 'the Gateway could not be queried',
};

const METHOD_TEXT: Record<string, string> = {
  ownerKeys: 'key listed in owner_keys',
  derivedAddress: 'virtual address derived from the key',
};

/** The local connector call that sends an equivalent request. */
function connectorCall(spec: WalletRequestSpec, network: 'mainnet' | 'stokenet', challenge: string | undefined) {
  const count = (c: { quantity: number; quantifier: string }) => ({ quantity: c.quantity, exactly: c.quantifier === 'exactly' });
  const accounts = spec.accounts ? { ...count(spec.accounts), with_proof: spec.accounts.withProof } : undefined;
  const personaData = spec.personaData
    ? {
        ...(spec.personaData.fullName ? { name: true } : {}),
        ...(spec.personaData.emailAddresses ? { emails: count(spec.personaData.emailAddresses) } : {}),
        ...(spec.personaData.phoneNumbers ? { phones: count(spec.personaData.phoneNumbers) } : {}),
      }
    : undefined;
  const base = {
    network,
    dapp_definition: dappDefinitionFor(network),
    origin: RADIX_COMMUNITY_ORIGIN,
    ...(challenge ? { challenge } : {}),
  };

  if (spec.auth === 'none') {
    return { tool: 'request_data', args: { ...base, accounts, persona_data: personaData } };
  }
  const onlyProof = spec.proofOfOwnership && !spec.accounts && !spec.personaData && !spec.reset?.accounts && !spec.reset?.personaData;
  if (onlyProof) {
    return {
      tool: 'request_ownership_proof',
      args: {
        ...base,
        identity_address: spec.identityAddress,
        accounts: spec.proofOfOwnership!.accountAddresses,
        prove_persona: spec.proofOfOwnership!.proveIdentity,
      },
    };
  }
  const ongoingAccounts = spec.accounts?.scope === 'ongoing';
  const ongoingData = spec.personaData?.scope === 'ongoing';
  return {
    tool: 'request_authorized',
    args: {
      ...base,
      auth: spec.auth === 'loginWithChallenge' ? 'login' : spec.auth === 'loginWithoutChallenge' ? 'login_without_challenge' : 'use_persona',
      identity_address: spec.identityAddress,
      [ongoingAccounts ? 'ongoing_accounts' : 'one_time_accounts']: accounts,
      [ongoingData ? 'ongoing_persona_data' : 'one_time_persona_data']: personaData,
      prove_accounts: spec.proofOfOwnership?.accountAddresses.length ? spec.proofOfOwnership.accountAddresses : undefined,
      prove_persona: spec.proofOfOwnership?.proveIdentity || undefined,
      reset_accounts: spec.reset?.accounts || undefined,
      reset_persona_data: spec.reset?.personaData || undefined,
    },
  };
}

export const buildWalletRequestTool = defineMcpTool({
  name: 'build_wallet_request',
  title: 'Build a Radix Wallet data / login / proof request',
  description:
    'Builds the exact wallet interaction (schema v2) a dApp sends to the Radix Wallet for ANY data request: one-time accounts and persona data (auth "none"), persona login with or without a signed challenge, reuse of a logged-in persona (use_persona), ongoing sharing, reset, and proof of ownership of known accounts and/or the persona. A request may ask for NO address at all (e.g. a login that only signs a challenge with the persona). Returns the interaction JSON, a fresh ROLA challenge when something is signed, the validation problems the wallet would reject, and the matching radix-connector call. Verify the signed answer with verify_rola_proofs.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    network: networkSchema,
    auth: z
      .enum(['none', 'login', 'login_without_challenge', 'use_persona'])
      .default('none')
      .describe('"none" = one-time request without persona; "login" = persona signs the challenge; "login_without_challenge"; "use_persona" = reuse identity_address.'),
    identity_address: z.string().optional().describe('Persona (identity_…) for auth "use_persona" and proof_of_ownership.'),
    accounts: countSchema
      .extend({
        with_proof: z.boolean().default(false).describe('Every shared account signs the challenge (ROLA).'),
        ongoing: z.boolean().default(false).describe('Share on every login (needs a persona).'),
      })
      .optional()
      .describe('Accounts to ask for. Omit to ask for no address.'),
    persona_data: z
      .object({
        full_name: z.boolean().default(false),
        email_addresses: countSchema.optional(),
        phone_numbers: countSchema.optional(),
        ongoing: z.boolean().default(false).describe('Share on every login (needs a persona).'),
      })
      .optional()
      .describe('Persona data to ask for: full_name, email_addresses and/or phone_numbers counts.'),
    reset: z
      .object({ accounts: z.boolean().default(false), persona_data: z.boolean().default(false) })
      .optional()
      .describe('Make the wallet forget what it shares with the dApp and ask again (needs a persona).'),
    proof_of_ownership: z
      .object({
        account_addresses: z.array(z.string()).max(30).default([]),
        prove_identity: z.boolean().default(false).describe('The persona (identity_address) signs too.'),
      })
      .optional()
      .describe('Sign the challenge with these known entities, nothing to pick. Requires auth "use_persona".'),
    challenge: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .optional()
      .describe('Your own 32-byte hex challenge. Omit to get a fresh one.'),
    origin: z.string().url().default(RADIX_COMMUNITY_ORIGIN).describe('Origin the wallet signs (part of every ROLA signature).'),
  }),
  handler: (input) => {
    const spec: WalletRequestSpec = {
      auth: AUTH_MAP[input.auth],
      identityAddress: input.identity_address,
      accounts: input.accounts
        ? {
            scope: input.accounts.ongoing ? 'ongoing' : 'oneTime',
            quantity: input.accounts.quantity,
            quantifier: input.accounts.quantifier,
            withProof: input.accounts.with_proof,
          }
        : undefined,
      personaData: input.persona_data
        ? {
            scope: input.persona_data.ongoing ? 'ongoing' : 'oneTime',
            fullName: input.persona_data.full_name,
            emailAddresses: input.persona_data.email_addresses,
            phoneNumbers: input.persona_data.phone_numbers,
          }
        : undefined,
      reset: input.reset ? { accounts: input.reset.accounts, personaData: input.reset.persona_data } : undefined,
      proofOfOwnership: input.proof_of_ownership
        ? {
            accountAddresses: input.proof_of_ownership.account_addresses,
            proveIdentity: input.proof_of_ownership.prove_identity,
          }
        : undefined,
    };

    const issues = validateWalletRequest(spec);
    if (issues.length > 0) {
      throw new Error(`The wallet would refuse this request:\n${issues.map((i) => `• ${ISSUE_TEXT[i] ?? i}`).join('\n')}`);
    }

    const signs = needsChallenge(spec);
    const challenge = signs ? (input.challenge?.toLowerCase() ?? generateRolaChallenge()) : undefined;
    const dAppDefinitionAddress = dappDefinitionFor(input.network);
    const interaction = buildWalletInteraction({
      items: buildWalletRequestItems(spec, challenge),
      networkId: networkIdFromName(input.network),
      dAppDefinitionAddress,
      origin: input.origin,
      interactionId: '<assigned when sent>',
    });
    const call = connectorCall(spec, input.network, challenge);
    const sharesAddresses = !!spec.accounts || (spec.proofOfOwnership?.accountAddresses.length ?? 0) > 0;

    return {
      text: cliRender(
        cliBanner('Wallet request · build'),
        cliKeyValues([
          ['Type', interaction.items.discriminator],
          ['Network', input.network],
          ['Signs a challenge', signs ? 'yes (ROLA)' : 'no'],
          ['Challenge', challenge],
          ['Shares addresses', sharesAddresses ? 'yes' : 'no'],
          ['dApp definition', dAppDefinitionAddress || '(not configured for this network)'],
          ['Origin', input.origin],
        ]),
        cliSection('Wallet interaction'),
        cliCode(JSON.stringify(interaction, null, 2), 'json'),
        cliSection('Send it with the local connector'),
        cliCode(JSON.stringify(call, null, 2), 'json'),
        cliNext([
          `Call ${call.tool} on radix-connector with these arguments; the user approves on the phone.`,
          signs
            ? 'Pass the returned proofs to verify_rola_proofs with the SAME challenge, network and origin.'
            : 'Nothing is signed: there are no proofs to verify.',
        ]),
      ),
      structured: { interaction, challenge: challenge ?? null, connector: call },
    };
  },
});

const proofSchema = z.object({
  type: z.enum(['account', 'persona']),
  address: z.string().min(10).max(120),
  proof: z.object({
    publicKey: z.string().max(200),
    signature: z.string().max(300),
    curve: z.enum(['curve25519', 'secp256k1']),
  }),
});

export const verifyRolaProofsTool = defineMcpTool({
  name: 'verify_rola_proofs',
  title: 'Verify ROLA signatures from the wallet',
  description:
    'Server-side ROLA verification of the signed challenge proofs a Radix Wallet returns (accounts and personas), exactly as a dApp backend must do before trusting them: checks the signature over the challenge + dApp definition + origin, and that the key controls the entity (owner_keys on the ledger, or the virtual address derived from the key). Reports the reason for every failure. Pass EITHER the raw wallet response (e.g. the "Raw answer" JSON radix-connector prints; every proof in it is found) OR proofs in the { type, address, proof: { publicKey, signature, curve } } format. Always pass the challenge YOU issued: verifying against the challenge inside the response would accept a replayed answer.',
  category: 'console',
  inputSchema: z.object({
    network: networkSchema,
    challenge: z.string().describe('The 32-byte hex challenge you issued (e.g. from build_wallet_request).'),
    wallet_response: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .optional()
      .describe('The raw wallet interaction response (JSON object or string), or its "items".'),
    proofs: z.array(proofSchema).max(30).optional().describe('Proofs in wallet/RDT format, instead of wallet_response.'),
    origin: z.string().url().default(RADIX_COMMUNITY_ORIGIN).describe('Origin the request was sent with.'),
    dapp_definition: z.string().optional().describe('dApp definition the request was sent with (default: this site for the network).'),
  }),
  handler: async ({ network, challenge, wallet_response, proofs, origin, dapp_definition }) => {
    let toVerify = proofs ?? [];
    if (wallet_response !== undefined) {
      let parsed: unknown = wallet_response;
      if (typeof wallet_response === 'string') {
        try {
          parsed = JSON.parse(wallet_response);
        } catch {
          throw new Error('wallet_response is not valid JSON.');
        }
      }
      const extracted = proofsFromWalletResponse(parsed);
      if (extracted.challenge && extracted.challenge.toLowerCase() !== challenge.toLowerCase()) {
        throw new Error(
          `The wallet signed another challenge (${extracted.challenge}) than the one given (${challenge}). Do not trust this answer.`,
        );
      }
      toVerify = [...toVerify, ...extracted.proofs];
    }
    if (toVerify.length === 0) {
      throw new Error('No proofs to verify: the response carries no signature (was a challenge requested?).');
    }

    const results: RolaProofResult[] = await verifyRolaProofs({
      networkId: networkIdFromName(network),
      dAppDefinitionAddress: dapp_definition ?? dappDefinitionFor(network),
      origin,
      challenge,
      proofs: toVerify,
      ownerKeys: gatewayOwnerKeys(network),
    });
    const valid = results.filter((r) => r.verified).length;

    return {
      text: cliRender(
        cliBanner('ROLA · verify proofs'),
        cliKeyValues([
          ['Result', valid === results.length ? 'ALL VALID' : `${results.length - valid} of ${results.length} INVALID`],
          ['Network', network],
          ['Origin', origin],
        ]),
        cliSection('Proofs'),
        cliTable(
          ['Type', 'Address', 'Valid', 'Why'],
          results.map((r) => [
            r.type,
            r.address,
            r.verified ? 'yes' : 'NO',
            r.verified ? METHOD_TEXT[r.method ?? ''] ?? '' : REASON_TEXT[r.reason ?? ''] ?? r.reason ?? '',
          ]),
        ),
      ),
      structured: { allValid: valid === results.length, results },
    };
  },
});

export const walletTools = [buildWalletRequestTool, verifyRolaProofsTool];
