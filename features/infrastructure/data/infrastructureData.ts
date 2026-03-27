import type { InfraLayer } from '@/features/infrastructure/types/data.types';

/**
 * Static definition of the 8 Radix infrastructure layers.
 * All human-readable strings (titles, descriptions) live in the i18n files.
 * This file only holds stable, non-translated metadata (IDs, icons, gradients).
 */
export const INFRA_LAYERS: InfraLayer[] = [
  {
    id: 'ledger',
    icon: 'Database',
    gradient: 'from-[var(--color-primary)] to-[var(--color-secondary)]',
    items: [
      { key: 'global_ledger', icon: 'Globe2' },
      { key: 'substate_model', icon: 'Layers' },
      { key: 'jmt', icon: 'GitBranch' },
    ],
  },
  {
    id: 'consensus',
    icon: 'Network',
    gradient: 'from-[var(--color-secondary)] to-[var(--color-accent)]',
    items: [
      { key: 'cerberus', icon: 'Cpu' },
      { key: 'hyperscale', icon: 'Zap' },
      { key: 'nodes', icon: 'Server' },
    ],
  },
  {
    id: 'execution',
    icon: 'Code2',
    gradient: 'from-[var(--color-accent)] to-[var(--color-gradient-start)]',
    items: [
      { key: 'radix_engine', icon: 'Cog' },
      { key: 'scrypto', icon: 'Terminal' },
      { key: 'blueprints', icon: 'Box' },
      { key: 'nft_catalog', icon: 'Gem' },
    ],
  },
  {
    id: 'defi',
    icon: 'TrendingUp',
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-mid)]',
    items: [
      { key: 'native_defi', icon: 'Blocks' },
      { key: 'atomic_composability', icon: 'Link2' },
    ],
  },
  {
    id: 'interoperability',
    icon: 'ArrowLeftRight',
    gradient: 'from-[var(--color-gradient-mid)] to-[var(--color-gradient-end)]',
    items: [
      { key: 'hyperlane', icon: 'Globe' },
      { key: 'instabridge', icon: 'Bridge' },
    ],
  },
  {
    id: 'frontend',
    icon: 'Monitor',
    gradient: 'from-[var(--color-gradient-end)] to-[var(--color-primary)]',
    items: [
      { key: 'rola', icon: 'KeyRound' },
      { key: 'rdt', icon: 'Package' },
      { key: 'manifests', icon: 'FileText' },
    ],
  },
  {
    id: 'identity',
    icon: 'Shield',
    gradient: 'from-[var(--color-primary)] to-[var(--color-accent)]',
    items: [
      { key: 'smart_accounts', icon: 'Wallet' },
      { key: 'radix_wallet', icon: 'Smartphone' },
      { key: 'radix_connect', icon: 'Wifi' },
    ],
  },
  {
    id: 'tooling',
    icon: 'Wrench',
    gradient: 'from-[var(--color-secondary)] to-[var(--color-gradient-mid)]',
    items: [
      { key: 'stokenet', icon: 'FlaskConical' },
      { key: 'resim', icon: 'Terminal' },
      { key: 'core_api', icon: 'Cable' },
      { key: 'gateway', icon: 'Router' },
      { key: 'dashboard', icon: 'BarChart2' },
    ],
  },
];
