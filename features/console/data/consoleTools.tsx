import {
  ArrowLeftRight,
  Coins,
  FileCode2,
  Rocket,
  Send,
  Settings2,
  Wrench,
} from 'lucide-react';
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
    icon: <Send className="size-5" />,
    gradient: 'from-blue-500 to-cyan-400',
    accentRgb: '59,130,246',
    requiresWallet: true,
    wide: true,
  },
  'create-token': {
    slug: 'create-token',
    icon: <Coins className="size-5" />,
    gradient: 'from-amber-400 to-orange-500',
    accentRgb: '251,191,36',
    requiresWallet: true,
  },
  'deploy-package': {
    slug: 'deploy-package',
    icon: <Rocket className="size-5" />,
    gradient: 'from-violet-600 to-fuchsia-500',
    accentRgb: '139,92,246',
    requiresWallet: true,
  },
  'transaction-manifest': {
    slug: 'transaction-manifest',
    icon: <FileCode2 className="size-5" />,
    gradient: 'from-emerald-400 to-teal-500',
    accentRgb: '52,211,153',
    requiresWallet: true,
    wide: true,
  },
  'configure-metadata': {
    slug: 'configure-metadata',
    icon: <Settings2 className="size-5" />,
    gradient: 'from-sky-500 to-indigo-500',
    accentRgb: '14,165,233',
    requiresWallet: true,
  },
  'convert-olympia-address': {
    slug: 'convert-olympia-address',
    icon: <ArrowLeftRight className="size-5" />,
    gradient: 'from-rose-500 to-orange-400',
    accentRgb: '244,63,94',
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
    id: 'assets',
    icon: <Coins className="size-5" />,
    gradient: 'from-blue-600 to-cyan-500',
    tools: ['send-transaction', 'create-token'],
  },
  {
    id: 'deploy',
    icon: <Rocket className="size-5" />,
    gradient: 'from-violet-600 to-fuchsia-500',
    tools: ['deploy-package', 'transaction-manifest'],
  },
  {
    id: 'utilities',
    icon: <Wrench className="size-5" />,
    gradient: 'from-emerald-500 to-teal-400',
    tools: ['configure-metadata', 'convert-olympia-address'],
  },
];

/** Tools highlighted on the console landing page. */
export const FEATURED_TOOL_SLUGS: ConsoleToolSlug[] = [
  'send-transaction',
  'create-token',
  'deploy-package',
  'transaction-manifest',
];

export const groupForTool = (slug: ConsoleToolSlug): ConsoleGroup =>
  CONSOLE_GROUPS.find((group) => group.tools.includes(slug)) ?? CONSOLE_GROUPS[0];
