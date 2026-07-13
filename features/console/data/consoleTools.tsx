import {
  ArrowLeftRight,
  Binary,
  Blocks,
  Bot,
  Coins,
  Droplets,
  FileCode2,
  FileLock2,
  FileSignature,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  MessageSquareLock,
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
  mcp: {
    slug: 'mcp',
    icon: <Bot className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '168,85,247',
    requiresWallet: false,
    wide: true,
  },
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
  'sign-document': {
    slug: 'sign-document',
    icon: <FileSignature className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '236,72,153',
    // Verify works without a wallet; the Sign tab self-gates on connection.
    requiresWallet: false,
    wide: true,
  },
  'encrypt-document': {
    slug: 'encrypt-document',
    icon: <FileLock2 className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '34,197,94',
    // Receiving/decrypting works without a wallet; the Encrypt tab self-gates.
    requiresWallet: false,
    wide: true,
  },
  chat: {
    slug: 'chat',
    icon: <MessageSquareLock className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    accentRgb: '14,165,233',
    // Both sides sign, but the tool self-gates with its own explanatory copy.
    requiresWallet: false,
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
    id: 'ai',
    icon: <Bot className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['mcp'],
  },
  {
    id: 'assets',
    icon: <Coins className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['send-transaction', 'staking', 'create-token', 'my-resources', 'faucet', 'claim-package-royalties'],
  },
  {
    id: 'deploy',
    icon: <Rocket className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['build-manifest', 'transaction-manifest', 'deploy-package', 'component-panel'],
  },
  {
    id: 'documents',
    icon: <FileSignature className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['sign-document', 'encrypt-document'],
  },
  {
    id: 'communication',
    icon: <MessageSquareLock className="size-5" />,
    gradient: 'from-[var(--color-gradient-start)] to-[var(--color-gradient-end)]',
    tools: ['chat'],
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
