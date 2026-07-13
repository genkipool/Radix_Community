'use client';

import { useState } from 'react';
import { Rocket, Stamp } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { NETWORKS } from '@/features/wallet/constants/network';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import { TextField } from '@/features/console/components/shared/fields';
import type { SignDictionary } from '../types/dictionary';
import { buildRadixSealDeployManifest } from '../lib/radix-seal-manifest';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { networkNameForId } from '../lib/network';

/**
 * One-time deploy of the Radix Seal brand resource. Shown only while the brand
 * is undeployed on the active network. After deploying, the user pastes the new
 * resource address into `features/sign/constants/seal.ts` (RADIX_SEAL).
 */
export function SealDeployPanel({ t }: { t: SignDictionary }) {
  const s = t.seal.deploy;
  const { activeNetworkId, accounts } = useRadixWallet();
  const { sendTransaction, isSending, result } = useConsoleTransaction();
  const account = accounts[0]?.address ?? null;
  const [imageUrl, setImageUrl] = useState(() =>
    typeof window === 'undefined' ? '' : sealImageUrl(window.location.origin),
  );

  // Already deployed on this network → nothing to do.
  if (activeNetworkId == null || radixSealAddress(activeNetworkId)) return null;

  const deployed = result?.createdEntities.find((a) => a.startsWith('resource_')) ?? null;

  const onDeploy = async () => {
    if (!account) return;
    const manifest = buildRadixSealDeployManifest({
      imageUrl: imageUrl.trim() || sealImageUrl(window.location.origin),
      origin: window.location.origin,
      dAppDefinition: NETWORKS[activeNetworkId].dAppDefinitionAddress || undefined,
    });
    await sendTransaction(manifest);
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

      {deployed ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            {s.done}
          </p>
          <div className="flex items-center gap-2 rounded-xl border p-2" style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)' }}>
            <code className="flex-1 truncate font-mono text-xs" style={{ color: 'var(--color-text-main)' }}>
              {deployed}
            </code>
            <CopyButton value={deployed} size="sm" />
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
            placeholder="https://…/seal/radix-seal.svg"
            hint={s.imageUrlHint}
          />
          <button
            type="button"
            disabled={!account || isSending}
            onClick={onDeploy}
            className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            {isSending ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            {isSending ? s.deploying : s.button}
          </button>
        </>
      )}
    </div>
  );
}
