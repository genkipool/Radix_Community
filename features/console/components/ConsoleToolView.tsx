'use client';

import { ComponentType } from 'react';
import type { Dictionary } from '@/i18n';
import { CONSOLE_TOOLS } from '../data/consoleTools';
import { useConsoleDictionary } from '../hooks/useConsoleDictionary';
import { WalletGate } from './shared/WalletGate';
import type { ConsoleToolSlug } from '../types/console.types';
import type { ConsoleDictionary } from '../types/i18n.types';

export interface ConsoleToolProps {
  t: ConsoleDictionary;
}

import SendTransactionTool from './tools/SendTransactionTool';
import CreateTokenTool from './tools/CreateTokenTool';
import BuildManifestTool from './tools/BuildManifestTool';
import ComponentPanelTool from './tools/ComponentPanelTool';
import MyResourcesTool from './tools/MyResourcesTool';
import SborDecoderTool from './tools/SborDecoderTool';
import AddressUtilsTool from './tools/AddressUtilsTool';
import FaucetTool from './tools/FaucetTool';
import WalletPlaygroundTool from './tools/WalletPlaygroundTool';
import DeployPackageTool from './tools/DeployPackageTool';
import TransactionManifestTool from './tools/TransactionManifestTool';
import ConfigureMetadataTool from './tools/ConfigureMetadataTool';
import ConvertOlympiaTool from './tools/ConvertOlympiaTool';

const TOOL_COMPONENTS: Record<ConsoleToolSlug, ComponentType<ConsoleToolProps>> = {
  'send-transaction': SendTransactionTool,
  'create-token': CreateTokenTool,
  'build-manifest': BuildManifestTool,
  'component-panel': ComponentPanelTool,
  'my-resources': MyResourcesTool,
  'sbor-decoder': SborDecoderTool,
  'address-utils': AddressUtilsTool,
  faucet: FaucetTool,
  'wallet-playground': WalletPlaygroundTool,
  'deploy-package': DeployPackageTool,
  'transaction-manifest': TransactionManifestTool,
  'configure-metadata': ConfigureMetadataTool,
  'convert-olympia-address': ConvertOlympiaTool,
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
