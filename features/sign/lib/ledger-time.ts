'use client';

/**
 * The network's own clock, for the `issued_at` written into every minted NFT.
 *
 * A mint CANNOT carry the consensus time of its own transaction: that time does
 * not exist until the transaction commits, and a manifest has no way to pipe the
 * result of `get_current_time` into the data of a `MINT` instruction. So
 * `issued_at` is unavoidably written before the fact, and the only question is
 * whose clock writes it.
 *
 * It used to be the signer's browser — a value with no relation to the ledger,
 * which could be set to any day at all and left nothing to contradict it. Taking
 * it from the Gateway's current ledger state makes it a real network time,
 * seconds ahead of the commit rather than years off, and turns the field into
 * something verification can CHECK: it re-reads the commit time of the minting
 * transaction and reports any NFT whose `issued_at` disagrees with it.
 *
 * That is the honest ceiling here. `issued_at` is a claim; what makes it useful
 * is that it is now a falsifiable one.
 */
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { RadixNetworkId } from '@/features/wallet/constants/network';

interface GatewayStatusResponse {
  ledger_state?: { proposer_round_timestamp?: string };
}

interface CommittedDetailsResponse {
  transaction?: { confirmed_at?: string; round_timestamp?: string };
}

/**
 * When the network agreed a transaction happened, by its intent hash.
 *
 * This is the date an anchored signature deserves: consensus, not the signer's
 * browser and not a third-party authority. Reading it back right after the
 * anchor lets the certificate — and the signature page printed into the PDF —
 * show the very moment a verifier will find on the ledger, instead of two
 * plausible dates a few seconds apart that a reader has to reconcile.
 *
 * Null when it cannot be resolved (the Gateway has yet to index the
 * transaction, typically); callers keep whatever date they already had.
 */
export async function fetchTransactionTime(
  networkId: number,
  intentHash: string,
): Promise<string | null> {
  if (!intentHash) return null;
  const net: Network =
    networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
  try {
    const data = await gatewayPost<CommittedDetailsResponse>(
      net,
      '/transaction/committed-details',
      { intent_hash: intentHash },
    );
    const stamp =
      data.transaction?.confirmed_at ?? data.transaction?.round_timestamp;
    return stamp && !Number.isNaN(Date.parse(stamp)) ? stamp : null;
  } catch {
    return null;
  }
}

/**
 * Current consensus time as ISO-8601, or the local clock when the Gateway
 * cannot be reached. The fallback never blocks a signature: by the time
 * anything is minted the Gateway has already answered several times (the seal
 * and collection were discovered through it), so this is a rare hiccup, and the
 * two clocks agree to within seconds in the normal case anyway.
 */
export async function fetchLedgerNow(networkId: number): Promise<string> {
  const net: Network =
    networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
  try {
    const status = await gatewayPost<GatewayStatusResponse>(
      net,
      '/status/gateway-status',
      {},
    );
    const stamp = status.ledger_state?.proposer_round_timestamp;
    // Only accept something that actually parses as a date.
    if (stamp && !Number.isNaN(Date.parse(stamp))) return stamp;
  } catch {
    /* fall through to the local clock */
  }
  return new Date().toISOString();
}
