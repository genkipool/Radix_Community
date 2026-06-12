'use client';

import { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type { Dictionary } from '@/i18n';
import { CONSOLE_TOOLS } from '../data/consoleTools';
import { useConsoleDictionary } from '../hooks/useConsoleDictionary';
import { WalletGate } from './shared/WalletGate';
import type { ConsoleToolSlug } from '../types/console.types';
import type { ConsoleDictionary } from '../types/i18n.types';

export interface ConsoleToolProps {
  t: ConsoleDictionary;
}

const toolLoading = () => (
  <div className="flex items-center justify-center py-24">
    <div
      className="size-9 rounded-full border-2 animate-spin"
      style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
    />
  </div>
);

/* Lazy-loaded tools — only the active tool's bundle is downloaded. */
const TOOL_COMPONENTS: Record<ConsoleToolSlug, ComponentType<ConsoleToolProps>> = {
  'send-transaction': dynamic(() => import('./tools/SendTransactionTool'), { loading: toolLoading }),
  'create-token': dynamic(() => import('./tools/CreateTokenTool'), { loading: toolLoading }),
  'deploy-package': dynamic(() => import('./tools/DeployPackageTool'), { loading: toolLoading }),
  'transaction-manifest': dynamic(() => import('./tools/TransactionManifestTool'), { loading: toolLoading }),
  'configure-metadata': dynamic(() => import('./tools/ConfigureMetadataTool'), { loading: toolLoading }),
  'convert-olympia-address': dynamic(() => import('./tools/ConvertOlympiaTool'), { loading: toolLoading }),
};

interface ConsoleToolViewProps {
  slug: ConsoleToolSlug;
  dictionary?: Partial<Dictionary>;
}

/** Tool page — header (icon, title, description) plus the tool itself. */
export default function ConsoleToolView({ slug, dictionary }: ConsoleToolViewProps) {
  const t = useConsoleDictionary(dictionary);

  const meta = CONSOLE_TOOLS[slug];
  const labels = ((t.tools ?? {}) as Record<string, { title?: string; description?: string }>)[slug] ?? {};
  const Tool = TOOL_COMPONENTS[slug];

  const content = <Tool t={t} />;

  return (
    <div className={`${meta.wide ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-8`}>
      <div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            {labels.title ?? slug}
          </h1>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.description ?? ''}
          </p>
        </div>
      </div>

      {meta.requiresWallet ? <WalletGate t={t.common}>{content}</WalletGate> : content}
    </div>
  );
}
