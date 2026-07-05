import {
  ArrowLeftRight,
  Binary,
  Blocks,
  Bot,
  Coins,
  Droplets,
  FileCode2,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Rocket,
  ScanSearch,
  Settings2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { RadixIcon } from '@/components/shared/RadixIcon';
import type { ReactNode } from 'react';
import type { ConsoleToolSlug } from '../types/console.types';

/* ─── Tool metadata ───────────────────────────────────────────────────────── */

export interface ConsoleToolMeta {
  slug: ConsoleToolSlug;
  icon: ReactNode;
  gradient: string;
  accentRgb: string;
  /** Tools that build and send wallet transactions need a connected wallet */
  requiresWallet: boolean;
  /** Tools with a collapsible side panel get a wider content column */
  wide?: boolean;
}

export const CONSOLE_TOOLS: Record<ConsoleToolSlug, ConsoleToolMeta> = {
  'send-transaction': {
    slug: 'send-transaction',
    icon: <RadixIcon className="size-5 text-white" strokeColor="currentColor" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '59,130,246',
    requiresWallet: true,
    wide: true,
  },
  staking: {
    slug: 'staking',
    icon: <Landmark className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '16,185,129',
    requiresWallet: true,
    wide: true,
  },
  'create-token': {
    slug: 'create-token',
    icon: <Coins className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '251,191,36',
    requiresWallet: true,
  },
  'build-manifest': {
    slug: 'build-manifest',
    icon: <Blocks className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '99,102,241',
    requiresWallet: true,
    wide: true,
  },
  'deploy-package': {
    slug: 'deploy-package',
    icon: <Rocket className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '139,92,246',
    requiresWallet: true,
  },
  'component-panel': {
    slug: 'component-panel',
    icon: <LayoutDashboard className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '6,182,212',
    requiresWallet: true,
  },
  'transaction-manifest': {
    slug: 'transaction-manifest',
    icon: <FileCode2 className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '52,211,153',
    requiresWallet: true,
    wide: true,
  },
  'configure-metadata': {
    slug: 'configure-metadata',
    icon: <Settings2 className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '14,165,233',
    requiresWallet: true,
  },
  'convert-olympia-address': {
    slug: 'convert-olympia-address',
    icon: <ArrowLeftRight className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '244,63,94',
    requiresWallet: false,
  },
  'my-resources': {
    slug: 'my-resources',
    icon: <Sparkles className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '251,191,36',
    requiresWallet: true,
  },
  'sbor-decoder': {
    slug: 'sbor-decoder',
    icon: <Binary className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '100,116,139',
    requiresWallet: false,
  },
  'address-utils': {
    slug: 'address-utils',
    icon: <ScanSearch className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '20,184,166',
    requiresWallet: false,
  },
  faucet: {
    slug: 'faucet',
    icon: <Droplets className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '56,189,248',
    requiresWallet: true,
  },
  'wallet-playground': {
    slug: 'wallet-playground',
    icon: <FlaskConical className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '217,70,239',
    requiresWallet: true,
  },
  'claim-package-royalties': {
    slug: 'claim-package-royalties',
    icon: <Coins className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '234,179,8',
    requiresWallet: true,
  },
  mcp: {
    slug: 'mcp',
    icon: <Bot className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '168,85,247',
    requiresWallet: false,
    wide: true,
  },
};

/* ─── Sidebar groups ──────────────────────────────────────────────────────── */

export interface ConsoleGroup {
  id: string;
  icon: ReactNode;
  gradient: string;
  tools: ConsoleToolSlug[];
}

export const CONSOLE_GROUPS: ConsoleGroup[] = [
  {
    id: 'assets',
    icon: <Coins className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['send-transaction', 'staking', 'create-token', 'my-resources', 'faucet'],
  },
  {
    id: 'deploy',
    icon: <Rocket className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['build-manifest', 'transaction-manifest', 'deploy-package', 'component-panel', 'claim-package-royalties'],
  },
  {
    id: 'utilities',
    icon: <Wrench className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: [
      'configure-metadata',
      'address-utils',
      'sbor-decoder',
      'convert-olympia-address',
      'wallet-playground',
    ],
  },
  {
    id: 'ai',
    icon: <Bot className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['mcp'],
  },
];

/** Tools highlighted on the console landing page. */
export const FEATURED_TOOL_SLUGS: ConsoleToolSlug[] = [
  'send-transaction',
  'build-manifest',
  'component-panel',
  'create-token',
];

export const groupForTool = (slug: ConsoleToolSlug): ConsoleGroup =>
  CONSOLE_GROUPS.find((group) => group.tools.includes(slug)) ?? CONSOLE_GROUPS[0];
