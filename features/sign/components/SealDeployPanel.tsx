'use client';

import { useState } from 'react';
import { BadgeCheck, Rocket, Stamp } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { NETWORKS } from '@/features/wallet/constants/network';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import { TextField } from '@/features/console/components/shared/fields';
import type { SignDictionary } from '../types/dictionary';
import {
  buildRadixSealDeployManifest,
  buildSealAdminBadgeManifest,
} from '../lib/radix-seal-manifest';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { networkNameForId } from '../lib/network';

/**
 * One-time deploy of the Radix Seal brand resource. Shown only while the brand
 * is undeployed on the active network. Two optional steps: mint an admin badge
 * (so the brand metadata stays editable by its holder), then deploy the brand.
 * After deploying, the user pastes the new resource address into
 * `features/sign/constants/seal.ts` (RADIX_SEAL).
 */
export function SealDeployPanel({ t }: { t: SignDictionary }) {
  const s = t.seal.deploy;
  const { activeNetworkId, accounts } = useRadixWallet();
  const { sendTransaction, isSending } = useConsoleTransaction();
  const account = accounts[0]?.address ?? null;
  const [imageUrl, setImageUrl] = useState(() => sealImageUrl());
  const [symbol, setSymbol] = useState('');
  const [adminBadge, setAdminBadge] = useState('');
  const [badgeMinted, setBadgeMinted] = useState(false);
  const [deployedSeal, setDeployedSeal] = useState<string | null>(null);
  const [pending, setPending] = useState<'badge' | 'deploy' | null>(null);

  // Already deployed on this network → nothing to do.
  if (activeNetworkId == null || radixSealAddress(activeNetworkId)) return null;

  const resourceFrom = (created: string[] | undefined) =>
    created?.find((a) => a.startsWith('resource_')) ?? null;

  const onMintBadge = async () => {
    if (!account) return;
    setPending('badge');
    const tx = await sendTransaction(
      buildSealAdminBadgeManifest({ account, imageUrl: imageUrl.trim() || sealImageUrl() }),
    );
    const badge = resourceFrom(tx?.createdEntities);
    if (badge) {
      setAdminBadge(badge);
      setBadgeMinted(true);
    }
    setPending(null);
  };

  const onDeploy = async () => {
    if (!account) return;
    setPending('deploy');
    const tx = await sendTransaction(
      buildRadixSealDeployManifest({
        imageUrl: imageUrl.trim() || sealImageUrl(),
        origin: window.location.origin,
        dAppDefinition: NETWORKS[activeNetworkId].dAppDefinitionAddress || undefined,
        adminBadge: adminBadge.trim() || undefined,
        symbol: symbol.trim() || undefined,
      }),
    );
    const seal = resourceFrom(tx?.createdEntities);
    if (seal) setDeployedSeal(seal);
    setPending(null);
  };

  return (
    <div
      className="space-y-4 rounded-2xl border p-5"
      style={{ borderColor: 'var(--color-primary)', background: 'var(--color-card-bg)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
          <Stamp className="size-4.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
            {s.title}
          </h3>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {s.subtitle.replace('{network}', networkNameForId(activeNetworkId))}
          </p>
        </div>
      </div>

      {deployedSeal ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            {s.done}
          </p>
          <div className="flex items-center gap-2 rounded-xl border p-2" style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)' }}>
            <code className="flex-1 truncate font-mono text-xs" style={{ color: 'var(--color-text-main)' }}>
              {deployedSeal}
            </code>
            <CopyButton value={deployedSeal} size="sm" />
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {s.paste}
          </p>
        </div>
      ) : (
        <>
          <TextField
            label={s.imageUrl}
            value={imageUrl}
            onChange={setImageUrl}
            placeholder="https://…/SVGs/radix-seal.svg"
            hint={s.imageUrlHint}
          />

          <TextField
            label={s.symbol}
            value={symbol}
            onChange={(value) => setSymbol(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            placeholder="SEAL"
            hint={s.symbolHint}
            maxLength={5}
          />

          {/* Admin badge: paste one or mint a fresh one, so brand metadata stays
              editable by its holder. Empty = immutable brand. */}
          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)' }}>
            <TextField
              label={s.adminBadgeLabel}
              value={adminBadge}
              onChange={setAdminBadge}
              placeholder={s.adminBadgePlaceholder}
              hint={s.adminBadgeHint}
            />
            {badgeMinted ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                <BadgeCheck className="size-3.5 shrink-0" />
                {s.badgeReady}
              </p>
            ) : (
              <button
                type="button"
                disabled={!account || isSending}
                onClick={onMintBadge}
                className="flex items-center gap-2 px-4 h-9 rounded-full font-bold text-xs border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
                style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
              >
                {pending === 'badge' ? (
                  <span className="size-3.5 rounded-full border-2 border-[var(--color-primary)]/40 border-t-[var(--color-primary)] animate-spin" />
                ) : (
                  <Stamp className="size-3.5" />
                )}
                {pending === 'badge' ? s.creatingBadge : s.createBadge}
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={!account || isSending}
            onClick={onDeploy}
            className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            {pending === 'deploy' ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            {pending === 'deploy' ? s.deploying : s.button}
          </button>
        </>
      )}
    </div>
  );
}
