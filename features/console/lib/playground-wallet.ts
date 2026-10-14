'use client';

/**
 * features/console/lib/playground-wallet.ts
 *
 * The wallet playground talks to the wallet through its OWN dApp toolkit
 * instance, kept apart from the one that holds the site session:
 *
 * - its state lives under a separate localStorage key, so a login or proof
 *   request answered here never replaces the accounts or persona of the
 *   user's session (the toolkit overwrites its state with every authorized
 *   response);
 * - it never touches the session toolkit's challenge generator;
 * - a request interceptor puts the exact items built by
 *   `buildWalletRequestItems` on the wire and records the interaction sent,
 *   so what the page shows is byte for byte what the wallet received.
 *
 * The toolkit only builds one-time requests itself, so every request is sent
 * as a one-time "carrier" whose items the interceptor replaces.
 */

import {
  EnvironmentModule,
  LocalStorageModule,
  OneTimeDataRequestBuilder,
  RadixDappToolkit,
  type WalletData,
} from '@radixdlt/radix-dapp-toolkit';
import { NETWORKS, type RadixNetworkId } from '@/features/wallet/constants/network';
import type { WalletInteraction, WalletRequestItems } from '@/features/wallet/lib/wallet-interaction';

type Toolkit = ReturnType<typeof RadixDappToolkit>;

interface Sandbox {
  rdt: Toolkit;
  storageKey: string;
  /** Items the next outgoing interaction must carry. */
  nextItems: WalletRequestItems | null;
  /** The interaction the interceptor last put on the wire. */
  lastSent: WalletInteraction | null;
}

const sandboxes = new Map<RadixNetworkId, Sandbox>();

function getSandbox(networkId: RadixNetworkId): Sandbox | null {
  if (typeof window === 'undefined') return null;
  const existing = sandboxes.get(networkId);
  if (existing) return existing;

  const { dAppDefinitionAddress } = NETWORKS[networkId];
  if (!dAppDefinitionAddress) return null;

  // Same prefix as the session toolkit (the type demands it), own partition:
  // the toolkit matches storage keys exactly, so the two never mix.
  const storageKey = `rdt:${dAppDefinitionAddress}:${networkId}:playground` as const;
  const environmentModule = EnvironmentModule();
  const sandbox: Sandbox = { rdt: null as unknown as Toolkit, storageKey, nextItems: null, lastSent: null };

  sandbox.rdt = RadixDappToolkit({
    dAppDefinitionAddress,
    networkId,
    applicationName: 'Radix Community · Wallet lab',
    applicationVersion: '1.0.0',
    useCache: false,
    providers: {
      environmentModule,
      storageModule: LocalStorageModule(storageKey, { providers: { environmentModule } }),
    },
    requestInterceptor: async (interaction) => {
      const sent = sandbox.nextItems
        ? ({ ...interaction, items: sandbox.nextItems } as typeof interaction)
        : interaction;
      sandbox.nextItems = null;
      sandbox.lastSent = sent as unknown as WalletInteraction;
      return sent;
    },
  });

  sandboxes.set(networkId, sandbox);
  return sandbox;
}

/** The raw wallet response the toolkit stored for an interaction, if any. */
function storedWalletResponse(storageKey: string, interactionId: string): unknown {
  try {
    const requests = JSON.parse(localStorage.getItem(`${storageKey}:requests`) ?? '{}') as Record<
      string,
      { walletResponse?: unknown }
    >;
    return requests[interactionId]?.walletResponse ?? null;
  } catch {
    return null;
  }
}

export type PlaygroundSendResult =
  | { ok: true; sent: WalletInteraction; walletData: WalletData; walletResponse: unknown }
  | { ok: false; sent: WalletInteraction | null; error: string; message?: string };

/** Sends request items to the wallet and waits for the answer. */
export async function sendPlaygroundRequest(
  networkId: RadixNetworkId,
  items: WalletRequestItems,
): Promise<PlaygroundSendResult> {
  const sandbox = getSandbox(networkId);
  if (!sandbox) return { ok: false, sent: null, error: 'toolkitUnavailable' };

  sandbox.nextItems = items;
  sandbox.lastSent = null;
  const result = await sandbox.rdt.walletApi.sendOneTimeRequest(
    OneTimeDataRequestBuilder.accounts().atLeast(1),
  );
  const sent = sandbox.lastSent as WalletInteraction | null;
  sandbox.nextItems = null;

  if (result.isErr()) {
    return { ok: false, sent, error: result.error.error, message: result.error.message };
  }
  return {
    ok: true,
    sent: sent!,
    walletData: result.value,
    walletResponse: sent ? storedWalletResponse(sandbox.storageKey, sent.interactionId) : null,
  };
}
