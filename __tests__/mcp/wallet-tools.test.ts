import { describe, expect, it, vi } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import { getMcpRegistry } from '@/services/mcp/tools';
import { RADIX_COMMUNITY_ORIGIN, dappDefinitionFor } from '@/services/mcp/dapp';
import { rolaSignatureMessage } from '@/services/rola/verify';

// The ledger lookup is the only network call: a never-used virtual entity has no owner_keys.
vi.mock('@/services/rola/gateway', () => ({ gatewayOwnerKeys: () => async () => [] }));

const registry = getMcpRegistry();
const CTX = { origin: 'https://example.test' };
const ACCOUNT = 'account_tdx_2_12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const call = (name: string, args: Record<string, unknown>) => registry.call(name, args, CTX);

describe('build_wallet_request', () => {
  it('builds a persona login that signs a challenge and shares no address', async () => {
    const res = await call('build_wallet_request', { network: 'stokenet', auth: 'login' });
    expect(res.isError).toBeUndefined();
    const { interaction, challenge, connector } = res.structuredContent as {
      interaction: { items: Record<string, unknown>; metadata: Record<string, unknown> };
      challenge: string;
      connector: { tool: string; args: Record<string, unknown> };
    };
    expect(challenge).toMatch(/^[0-9a-f]{64}$/);
    expect(interaction.items).toEqual({
      discriminator: 'authorizedRequest',
      auth: { discriminator: 'loginWithChallenge', challenge },
      reset: { accounts: false, personaData: false },
    });
    expect(interaction.metadata).toMatchObject({ version: 2, networkId: 2, origin: RADIX_COMMUNITY_ORIGIN });
    expect(connector.tool).toBe('request_authorized');
    expect(connector.args).toMatchObject({ auth: 'login', challenge, network: 'stokenet' });
  });

  it('routes a pure proof of ownership (persona + account) to request_ownership_proof with the given challenge', async () => {
    const challenge = 'cd'.repeat(32);
    const identity = 'identity_tdx_2_12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const res = await call('build_wallet_request', {
      network: 'stokenet',
      auth: 'use_persona',
      identity_address: identity,
      proof_of_ownership: { account_addresses: [ACCOUNT], prove_identity: true },
      challenge,
    });
    const out = res.structuredContent as { connector: { tool: string; args: Record<string, unknown> } };
    expect(out.connector).toEqual({
      tool: 'request_ownership_proof',
      args: {
        network: 'stokenet',
        dapp_definition: dappDefinitionFor('stokenet'),
        origin: RADIX_COMMUNITY_ORIGIN,
        challenge,
        identity_address: identity,
        accounts: [ACCOUNT],
        prove_persona: true,
      },
    });
  });

  it('one-time data needs no challenge and maps to request_data', async () => {
    const res = await call('build_wallet_request', {
      network: 'mainnet',
      persona_data: { full_name: true, email_addresses: { quantity: 1, quantifier: 'exactly' } },
    });
    const out = res.structuredContent as { challenge: null; connector: { tool: string; args: Record<string, unknown> } };
    expect(out.challenge).toBeNull();
    expect(out.connector.tool).toBe('request_data');
    expect(out.connector.args.persona_data).toEqual({ name: true, emails: { quantity: 1, exactly: true } });
  });

  it('refuses a proof of the persona alone, pointing to a login instead', async () => {
    const res = await call('build_wallet_request', {
      network: 'stokenet',
      auth: 'use_persona',
      identity_address: 'identity_tdx_2_12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      proof_of_ownership: { prove_identity: true },
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/use auth "login" with no accounts/);
  });

  it('refuses what the wallet would refuse, explaining why', async () => {
    const res = await call('build_wallet_request', {
      network: 'stokenet',
      accounts: { quantity: 1, ongoing: true },
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/ongoing accounts\/data need a persona/);
  });
});

describe('verify_rola_proofs', () => {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = Buffer.from(ed25519.getPublicKey(privateKey)).toString('hex');
  const challenge = 'ef'.repeat(32);
  const sign = (origin: string) =>
    Buffer.from(ed25519.sign(rolaSignatureMessage(challenge, dappDefinitionFor('stokenet'), origin), privateKey)).toString('hex');

  it('accepts a persona proof signed like the wallet and rejects a foreign origin', async () => {
    const identity = await RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(new PublicKey.Ed25519(publicKey), 2);
    const proof = (origin: string) => ({
      type: 'persona',
      address: identity,
      proof: { publicKey, signature: sign(origin), curve: 'curve25519' },
    });
    const res = await call('verify_rola_proofs', {
      network: 'stokenet',
      challenge,
      proofs: [proof(RADIX_COMMUNITY_ORIGIN), proof('https://evil.example')],
    });
    const out = res.structuredContent as { allValid: boolean; results: Array<{ verified: boolean; reason?: string }> };
    expect(out.allValid).toBe(false);
    expect(out.results.map((r) => r.reason ?? 'ok')).toEqual(['ok', 'invalidSignature']);
    expect(res.content[0].text).toContain('does not cover this challenge');
  });
});
