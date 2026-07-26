'use client';

import { ComponentType } from 'react';
import type { Dictionary } from '@/i18n';
import { CONSOLE_TOOLS } from '../data/consoleTools';
import { useConsoleDictionary } from '../hooks/useConsoleDictionary';
import { WalletGate } from './shared/WalletGate';
import type { ConsoleToolSlug } from '../types/console.types';
import type { ConsoleDictionary } from '../types/i18n.types';

/**
 * Console tool architecture (two intentional categories)
 * ------------------------------------------------------
 * Every tool is one entry in `TOOL_COMPONENTS`, mounted with `ConsoleToolProps`
 * and gated behind `WalletGate`. Two shapes exist on purpose:
 *
 * 1. Console-native utilities (send-transaction, create-token, my-resources,
 *    sbor-decoder, …). Their whole implementation lives under
 *    `features/console` and they read their strings from the `console`
 *    dictionary passed in as the `t` prop below (some also call `useLanguage()`
 *    only for `language`, never for the dictionary). They do not exist outside
 *    the console.
 *
 * 2. Large cross-cutting features (sign, cipher, chat). These are first-class
 *    features under `features/sign`, `features/cipher`, `features/chat`, each
 *    with its own locales, hooks, lib, services and types (on-ledger signing,
 *    WebRTC transport, browser crypto). The component here is a THIN ADAPTER:
 *    it loads the feature's own namespace via `useLanguage()` (`full.sign`,
 *    `full.cipher`, `full.chat`, enriched by the console layout) and delegates
 *    to the feature's components. It still receives the console `t` and passes
 *    it down when it renders shared console UI (e.g. the simulate panel).
 *
 * Keeping the big features separate is deliberate: the console is only one
 * consumer, and folding them in here would couple reusable crypto/P2P code to
 * the console shell. New small utilities follow shape 1; anything with its own
 * substantial domain follows shape 2.
 */
export interface ConsoleToolProps {
  t: ConsoleDictionary;
}

import SendTransactionTool from './tools/SendTransactionTool';
import StakingTool from './tools/StakingTool';
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
import ClaimPackageRoyaltiesTool from './tools/ClaimPackageRoyaltiesTool';
import McpTool from './tools/McpTool';
import SignCollectionTool from './tools/SignCollectionTool';
import SignDocumentTool from './tools/SignDocumentTool';
import EncryptDocumentTool from './tools/EncryptDocumentTool';
import ChatTool from './tools/ChatTool';
import AddressBookTool from './tools/AddressBookTool';

const TOOL_COMPONENTS: Record<ConsoleToolSlug, ComponentType<ConsoleToolProps>> = {
  'send-transaction': SendTransactionTool,
  staking: StakingTool,
  'create-token': CreateTokenTool,
  'build-manifest': BuildManifestTool,
  'component-panel': ComponentPanelTool,
  'my-resources': MyResourcesTool,
  'sbor-decoder': SborDecoderTool,
  'address-utils': AddressUtilsTool,
  'address-book': AddressBookTool,
  faucet: FaucetTool,
  'wallet-playground': WalletPlaygroundTool,
  'deploy-package': DeployPackageTool,
  'transaction-manifest': TransactionManifestTool,
  'configure-metadata': ConfigureMetadataTool,
  'convert-olympia-address': ConvertOlympiaTool,
  'claim-package-royalties': ClaimPackageRoyaltiesTool,
  mcp: McpTool,
  'sign-collection': SignCollectionTool,
  'sign-document': SignDocumentTool,
  'encrypt-document': EncryptDocumentTool,
  chat: ChatTool,
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
