import 'server-only';
import { z } from 'zod';
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import { verifyRolaProofs, type RolaProof } from '@/services/rola/verify';
import { gatewayOwnerKeys } from '@/services/rola/gateway';
import type { SessionAccount } from './sessionToken';

/**
 * What a login proves: the wallet signed this site's one-time challenge with
 * the persona. The accounts it shares sign nothing (a Ledger account would
 * need the Ledger): the session uses them only to show them, and the tools
 * that act on an account's ownership ask for their own proof.
 */

const address = z.string().min(10).max(120);

const sharedAccount = z.object({
    address,
    label: z.string().max(100),
    appearanceId: z.number().int().min(0).max(100),
});

const proofSchema = z.object({
    // Account proofs from an older client are accepted and ignored.
    type: z.enum(['persona', 'account']),
    address,
    proof: z.object({
        publicKey: z.string().max(200),
        signature: z.string().max(300),
        curve: z.enum(['curve25519', 'secp256k1']),
    }),
});

/** The body a login or update posts: the wallet's answer, with its proofs. */
export const walletProofsBodySchema = z.object({
    networkId: z.union([z.literal(RadixNetworkId.Mainnet), z.literal(RadixNetworkId.Stokenet)]),
    challenge: z.string().regex(/^[0-9a-f]{64}$/),
    identityAddress: address,
    personaLabel: z.string().max(100).optional(),
    accounts: z.array(sharedAccount).max(50),
    proofs: z.array(proofSchema).min(1).max(51),
});

export type WalletProofsBody = z.infer<typeof walletProofsBodySchema>;

/** The body an account update posts: the accounts the logged-in persona now shares. */
export const sharedAccountsBodySchema = z.object({
    networkId: walletProofsBodySchema.shape.networkId,
    identityAddress: address,
    accounts: z.array(sharedAccount).max(50),
});

export interface ProvenWallet {
    /** Whether the persona signed the challenge. */
    personaProven: boolean;
    /** The accounts the wallet shared. */
    accounts: SessionAccount[];
}

/** Checks the persona's proof against this site's origin and dApp definition on the body's network. */
export async function verifyWalletProofs(body: WalletProofsBody): Promise<ProvenWallet> {
    const origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin) throw new Error('NEXT_PUBLIC_APP_URL is not set');
    const config = NETWORKS[body.networkId];

    const results = await verifyRolaProofs({
        networkId: config.networkId,
        dAppDefinitionAddress: config.dAppDefinitionAddress,
        origin,
        challenge: body.challenge,
        proofs: (body.proofs as RolaProof[]).filter((p) => p.type === 'persona'),
        ownerKeys: gatewayOwnerKeys(body.networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet'),
    });
    return {
        personaProven: results.some(
            (r) => r.verified && r.type === 'persona' && r.address === body.identityAddress,
        ),
        accounts: body.accounts,
    };
}
