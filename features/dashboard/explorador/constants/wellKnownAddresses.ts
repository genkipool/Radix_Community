/**
 * features/dashboard/explorador/constants/wellKnownAddresses.ts
 *
 * Registry of well-known Radix protocol addresses (mainnet & stokenet)
 * with bilingual tooltip descriptions.
 *
 * Used to add descriptive tooltips on entity-type label badges when
 * hovering over a well-known address in the transaction explorer.
 */

import type { Network } from '@/features/dashboard/types';

// ─────────────────────────────────────────
//  Address → Key mappings
// ─────────────────────────────────────────

const MAINNET_ADDRESSES: Record<string, string> = {
  'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd': 'xrd',
  'resource_rdx1nfxxxxxxxxxxsecpsgxxxxxxxxx004638826440xxxxxxxxxsecpsg': 'secp256k1_signature_virtual_badge',
  'resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed25sg': 'ed25519_signature_virtual_badge',
  'resource_rdx1nfxxxxxxxxxxsystxnxxxxxxxxx002683325037xxxxxxxxxsystxn': 'system_transaction_badge',
  'resource_rdx1nfxxxxxxxxxxpkcllrxxxxxxxxx003652646977xxxxxxxxxpkcllr': 'package_of_direct_caller_virtual_badge',
  'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr': 'global_caller_virtual_badge',
  'resource_rdx1nfxxxxxxxxxxpkgwnrxxxxxxxxx002558553505xxxxxxxxxpkgwnr': 'package_owner_badge',
  'resource_rdx1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxvdrwnr': 'validator_owner_badge',
  'resource_rdx1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxxaccwnr': 'account_owner_badge',
  'resource_rdx1nfxxxxxxxxxxdntwnrxxxxxxxxx002876444928xxxxxxxxxdntwnr': 'identity_owner_badge',
  'package_rdx1pkgxxxxxxxxxpackgexxxxxxxxx000726633226xxxxxxxxxpackge': 'package_package',
  'package_rdx1pkgxxxxxxxxxresrcexxxxxxxxx000538436477xxxxxxxxxresrce': 'resource_package',
  'package_rdx1pkgxxxxxxxxxaccntxxxxxxxxxx000929625493xxxxxxxxxaccntx': 'account_package',
  'package_rdx1pkgxxxxxxxxxdntyxxxxxxxxxxx008560783089xxxxxxxxxdntyxx': 'identity_package',
  'package_rdx1pkgxxxxxxxxxcnsmgrxxxxxxxxx000746305335xxxxxxxxxcnsmgr': 'consensus_manager_package',
  'package_rdx1pkgxxxxxxxxxcntrlrxxxxxxxxx000648572295xxxxxxxxxcntrlr': 'access_controller_package',
  'package_rdx1pkgxxxxxxxxxtxnpxrxxxxxxxxx002962227406xxxxxxxxxtxnpxr': 'transaction_processor_package',
  'package_rdx1pkgxxxxxxxxxmtdataxxxxxxxxx005246577269xxxxxxxxxmtdata': 'metadata_module_package',
  'package_rdx1pkgxxxxxxxxxryaltyxxxxxxxxx003849573396xxxxxxxxxryalty': 'royalty_module_package',
  'package_rdx1pkgxxxxxxxxxarulesxxxxxxxxx002304462983xxxxxxxxxarules': 'role_assignment_module_package',
  'package_rdx1pkgxxxxxxxxxgenssxxxxxxxxxx004372642773xxxxxxxxxgenssx': 'genesis_helper_package',
  'package_rdx1pkgxxxxxxxxxfaucetxxxxxxxxx000034355863xxxxxxxxxfaucet': 'faucet_package',
  'package_rdx1pkgxxxxxxxxxplxxxxxxxxxxxxx020379220524xxxxxxxxxplxxxx': 'pool_package',
  'package_rdx1pkgxxxxxxxxxtxtrakxxxxxxxxx000595975309xxxxxxxxxtxtrak': 'transaction_tracker_package',
  'package_rdx1pkgxxxxxxxxxlckerxxxxxxxxxx000208064247xxxxxxxxxlckerx': 'locker_package',
  'package_rdx1phua8spmaxapwq56stduucrvztk92gxzjy9c98h0qemfjec03k9pjp': 'test_utils_package',
  'consensusmanager_rdx1scxxxxxxxxxxcnsmgrxxxxxxxxx000999665565xxxxxxxxxcnsmgr': 'consensus_manager',
  'component_rdx1cptxxxxxxxxxgenssxxxxxxxxxx000977302539xxxxxxxxxgenssx': 'genesis_helper',
  'component_rdx1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxfaucet': 'faucet',
  'transactiontracker_rdx1stxxxxxxxxxxtxtrakxxxxxxxxx006844685494xxxxxxxxxtxtrak': 'transaction_tracker',
};

const STOKENET_ADDRESSES: Record<string, string> = {
  'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc': 'xrd',
  'resource_tdx_2_1nfxxxxxxxxxxsecpsgxxxxxxxxx004638826440xxxxxxxxxcdcdpa': 'secp256k1_signature_virtual_badge',
  'resource_tdx_2_1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa': 'ed25519_signature_virtual_badge',
  'resource_tdx_2_1nfxxxxxxxxxxsystxnxxxxxxxxx002683325037xxxxxxxxxcss8hx': 'system_transaction_badge',
  'resource_tdx_2_1nfxxxxxxxxxxpkcllrxxxxxxxxx003652646977xxxxxxxxxfzcnwk': 'package_of_direct_caller_virtual_badge',
  'resource_tdx_2_1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxqtcnwk': 'global_caller_virtual_badge',
  'resource_tdx_2_1nfxxxxxxxxxxpkgwnrxxxxxxxxx002558553505xxxxxxxxxfzgzzk': 'package_owner_badge',
  'resource_tdx_2_1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxyerzzk': 'validator_owner_badge',
  'resource_tdx_2_1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxx4vczzk': 'account_owner_badge',
  'resource_tdx_2_1nfxxxxxxxxxxdntwnrxxxxxxxxx002876444928xxxxxxxxx98tzzk': 'identity_owner_badge',
  'package_tdx_2_1pkgxxxxxxxxxpackgexxxxxxxxx000726633226xxxxxxxxxehawfs': 'package_package',
  'package_tdx_2_1pkgxxxxxxxxxresrcexxxxxxxxx000538436477xxxxxxxxxmn4mes': 'resource_package',
  'package_tdx_2_1pkgxxxxxxxxxaccntxxxxxxxxxx000929625493xxxxxxxxx9jat20': 'account_package',
  'package_tdx_2_1pkgxxxxxxxxxdntyxxxxxxxxxxx008560783089xxxxxxxxx4ewu80': 'identity_package',
  'package_tdx_2_1pkgxxxxxxxxxcnsmgrxxxxxxxxx000746305335xxxxxxxxxqe4rf2': 'consensus_manager_package',
  'package_tdx_2_1pkgxxxxxxxxxcntrlrxxxxxxxxx000648572295xxxxxxxxxqewm72': 'access_controller_package',
  'package_tdx_2_1pkgxxxxxxxxxtxnpxrxxxxxxxxx002962227406xxxxxxxxxnvke82': 'transaction_processor_package',
  'package_tdx_2_1pkgxxxxxxxxxmtdataxxxxxxxxx005246577269xxxxxxxxxrpg925': 'metadata_module_package',
  'package_tdx_2_1pkgxxxxxxxxxryaltyxxxxxxxxx003849573396xxxxxxxxxmwc82d': 'royalty_module_package',
  'package_tdx_2_1pkgxxxxxxxxxarulesxxxxxxxxx002304462983xxxxxxxxx9fe8ce': 'role_assignment_module_package',
  'package_tdx_2_1pkgxxxxxxxxxgenssxxxxxxxxxx004372642773xxxxxxxxxsnkg30': 'genesis_helper_package',
  'package_tdx_2_1pkgxxxxxxxxxfaucetxxxxxxxxx000034355863xxxxxxxxx3heqcz': 'faucet_package',
  'package_tdx_2_1pkgxxxxxxxxxplxxxxxxxxxxxxx020379220524xxxxxxxxxe4r780': 'pool_package',
  'package_tdx_2_1pkgxxxxxxxxxtxtrakxxxxxxxxx000595975309xxxxxxxxxnvwmul': 'transaction_tracker_package',
  'package_tdx_2_1pkgxxxxxxxxxlckerxxxxxxxxxx000208064247xxxxxxxxx8jnpz0': 'locker_package',
  'package_tdx_2_1phua8spmaxapwq56stduucrvztk92gxzjy9c98h0qemfjec0fuqeng': 'test_utils_package',
  'consensusmanager_tdx_2_1scxxxxxxxxxxcnsmgrxxxxxxxxx000999665565xxxxxxxxxv6cg29': 'consensus_manager',
  'component_tdx_2_1cptxxxxxxxxxgenssxxxxxxxxxx000977302539xxxxxxxxx9cs7tj': 'genesis_helper',
  'component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl': 'faucet',
  'transactiontracker_tdx_2_1stxxxxxxxxxxtxtrakxxxxxxxxx006844685494xxxxxxxxxxzw7jp': 'transaction_tracker',
};

// ─────────────────────────────────────────
//  Known Account Labels (CEX, etc.)
// ─────────────────────────────────────────

export interface KnownAccountLabel {
  name: string;
  category: 'cex' | 'protocol' | 'foundation' | 'community';
  iconUrl?: string;
}

const KUCOIN_LABEL: KnownAccountLabel = {
  name: 'KuCoin',
  category: 'cex',
  iconUrl: '/images/exchanges/kucoin.png',
};

const GATE_IO_LABEL: KnownAccountLabel = {
  name: 'Gate.io',
  category: 'cex',
  iconUrl: '/images/exchanges/gate-io.png',
};

const MAINNET_KNOWN_ACCOUNTS: Record<string, KnownAccountLabel> = {
  // KuCoin — verified via DefiLlama CEX Proof of Reserves (projects/kucoin/index.js)
  'account_rdx16x4ryh2tnlfxw3ezwuuktczgp7wekhy89szxgkqanqvf4ygpy0rley': KUCOIN_LABEL,
  'account_rdx168m6px4dqaqtpyqhgr35f2zw54f80mtmxpzggvr2gwpx6l38uxlpge': KUCOIN_LABEL,
  'account_rdx16xvsegdgs5u7jggrvekcmcle7mrcxntlk879qwntvw525dww0qnpnx': KUCOIN_LABEL,
  'account_rdx169z44u9avlmqfkshpeav32p8sg955zsa4d8vs2qsy3ruey2p3xer7g': KUCOIN_LABEL,
  // Gate.io — verified via DefiLlama CEX Proof of Reserves (projects/gate-io/index.js)
  'account_rdx16y5vw2latcyn7h2leujsc0th2junpgxnafx0aqrher4yw7pmnmfyx8': GATE_IO_LABEL,
  'account_rdx16xkm9wvwcwq0q8ly6hm6m86s90zcqxeexhnzn8l9jkgtk3t8z7j2yz': GATE_IO_LABEL,
  'account_rdx169r653rp86kepz28wrzlxzy6ll2use5jmew5rz9h24uyj9cjqtl38n': GATE_IO_LABEL,
};

// ─────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────

/**
 * Returns the known entity label for a labeled account address (e.g. a CEX
 * wallet), or `null` if the address is not in the registry.
 */
export function getKnownAccountLabel(
  address: string,
  network: Network = 'mainnet',
): KnownAccountLabel | null {
  if (!address || network !== 'mainnet') return null;
  return MAINNET_KNOWN_ACCOUNTS[address] ?? null;
}

export const CEX_RANKING_KEYS = ['exchanges', 'cex_kucoin', 'cex_gate_io'] as const;
export type CexRankingKey = (typeof CEX_RANKING_KEYS)[number];

const CEX_RANKING_FILTER: Record<CexRankingKey, string | null> = {
  exchanges: null,
  cex_kucoin: 'KuCoin',
  cex_gate_io: 'Gate.io',
};

export function isCexRankingKey(value: string | null | undefined): value is CexRankingKey {
  return !!value && (CEX_RANKING_KEYS as readonly string[]).includes(value);
}

/**
 * Returns the verified CEX account addresses for a given explorer filter key
 * (`exchanges` for all verified CEXes, or a single exchange key).
 */
export function getKnownCexAddresses(
  network: Network = 'mainnet',
  key: CexRankingKey = 'exchanges',
): string[] {
  if (network !== 'mainnet') return [];
  const exchangeName = CEX_RANKING_FILTER[key];
  return Object.entries(MAINNET_KNOWN_ACCOUNTS)
    .filter(([, meta]) => meta.category === 'cex' && (!exchangeName || meta.name === exchangeName))
    .map(([address]) => address);
}

/**
 * Returns the translation key for a well-known Radix address,
 * or `null` if the address is not recognized.
 */
export function getWellKnownKey(
  address: string,
  network: Network,
): string | null {
  const map = network === 'stokenet' ? STOKENET_ADDRESSES : MAINNET_ADDRESSES;
  return map[address] || null;
}

/**
 * Returns true when `address` is the built-in Radix Faucet component
 * on either Mainnet or Stokenet.
 */
export function isFaucetAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  return MAINNET_ADDRESSES[address] === 'faucet' || STOKENET_ADDRESSES[address] === 'faucet';
}

/**
 * Returns a generic translation key based on the address prefix
 * (e.g., 'account_', 'resource_'), or `null` if the prefix is unrecognized.
 */
export function getGenericTooltipKey(address: string): string | null {
  if (!address) return null;
  if (address.startsWith('account_')) return 'account';
  if (address.startsWith('resource_')) return 'resource';
  if (address.startsWith('component_')) return 'component';
  if (address.startsWith('package_')) return 'package';
  if (address.startsWith('validator_')) return 'validator';
  if (address.startsWith('identity_')) return 'identity';
  if (address.startsWith('pool_')) return 'package';
  return null;
}
