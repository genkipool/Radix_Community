'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Link2, Save, Trash2, Upload, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import {
  downloadManifestFile,
  encodeManifestParam,
  loadSavedManifests,
  removeSavedManifest,
  saveManifest,
  SHARE_URL_LIMIT,
  type SavedManifest,
} from '../../lib/saved-manifests';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { ConsoleDictionary } from '../../types/i18n.types';

interface ManifestLibraryProps {
  t: ConsoleDictionary['library'];
  /** Manifest currently in the editor/builder ('' disables save/export/share) */
  manifest: string;
  /** Loads a stored/imported manifest into the caller (omit to hide loading UI) */
  onLoad?: (manifest: string) => void;
  disabled?: boolean;
}

const actionClass =
  'inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer disabled:opacity-40 disabled:pointer-events-none';

/**
 * Save / load / export / import / share controls for manifests.
 * Stored manifests live in localStorage and are shared across tools.
 */
export function ManifestLibrary({ t, manifest, onLoad, disabled }: ManifestLibraryProps) {
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const [saved, setSaved] = useState<SavedManifest[]>(() =>
    typeof window === 'undefined' ? [] : loadSavedManifests(activeNetwork),
  );

  // Reload saved manifests when network changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(loadSavedManifests(activeNetwork));
  }, [activeNetwork]);
  const [isNaming, setIsNaming] = useState(false);
  const [name, setName] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [txHashInput, setTxHashInput] = useState('');
  const [isFetchingHash, setIsFetchingHash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasManifest = !!manifest.trim();
  const shareTooLong = encodeManifestParam(manifest).length > SHARE_URL_LIMIT;

  const handleFetchHash = async (hashToFetch?: string) => {
    const hash = (hashToFetch ?? txHashInput).trim();
    if (!hash || !hash.startsWith('txid_') || !onLoad) return;
    setIsFetchingHash(true);
    try {
      const res = await fetch(`/api/transactions/${hash}?network=${activeNetwork}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.manifest_instructions) {
          onLoad(data.manifest_instructions);
        }
      }
    } finally {
      setIsFetchingHash(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    setSaved(saveManifest(name, manifest, activeNetwork));
    setIsNaming(false);
    setName('');
  };

  const handleShare = () => {
    const url = `${window.location.origin}/${language}/console/transaction-manifest?m=${encodeManifestParam(manifest)}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    });
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file || !onLoad) return;
    onLoad(await file.text());
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={disabled || !hasManifest}
          onClick={() => setIsNaming((prev) => !prev)}
          title={t.saveHint}
          className={actionClass}
          style={{ color: 'var(--color-primary)' }}
        >
          <Save className="size-3.5" />
          {t.save}
        </button>
        <button
          type="button"
          disabled={disabled || !hasManifest}
          onClick={() => downloadManifestFile(manifest, saved[0]?.name)}
          title={t.exportHint}
          className={actionClass}
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Download className="size-3.5" />
          {t.export}
        </button>
        {onLoad && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            title={t.importHint}
            className={actionClass}
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Upload className="size-3.5" />
            {t.import}
          </button>
        )}
        <button
          type="button"
          disabled={disabled || !hasManifest || shareTooLong}
          onClick={handleShare}
          title={shareTooLong ? t.shareTooLong : t.shareHint}
          className={actionClass}
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Link2 className="size-3.5" />
          {shareCopied ? t.shareCopied : t.share}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".rtm,.txt"
          className="hidden"
          onChange={(e) => {
            handleImportFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {onLoad && (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative w-full">
              <input
                type="text"
                value={txHashInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setTxHashInput(val);
                  const hash = val.trim();
                  // txid lengths vary by network (e.g., txid_rdx1... is 69, txid_stokenet1... is 66)
                  if (hash.startsWith('txid_') && hash.length > 60) {
                    handleFetchHash(hash);
                  } else {
                    onLoad('');
                  }
                }}
                placeholder={isFetchingHash ? 'Cargando...' : t.fetchHashPlaceholder}
                disabled={disabled}
                className="w-full rounded-xl border pl-3 pr-8 py-1.5 text-xs outline-none focus:border-[var(--color-primary)] transition-colors"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              />
              {txHashInput && (
                <button
                  type="button"
                  disabled={disabled || isFetchingHash}
                  onClick={() => {
                    setTxHashInput('');
                    onLoad('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors hover:text-[var(--color-primary)] text-[var(--color-text-muted)] cursor-pointer disabled:opacity-50"
                  title="Borrar"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isNaming && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={t.namePlaceholder}
            className="flex-1 max-w-xs rounded-xl border px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] disabled:opacity-40 cursor-pointer"
          >
            {t.confirmSave}
          </button>
        </div>
      )}

      {onLoad && saved.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            {t.savedTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            {saved.map((entry) => (
              <span
                key={entry.id}
                className="inline-flex items-center gap-1.5 rounded-xl border pl-2.5 pr-1 py-1 text-xs"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onLoad(entry.manifest)}
                  title={t.loadHint}
                  className="inline-flex items-center gap-1.5 font-semibold cursor-pointer transition-colors hover:text-[var(--color-primary)]"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  <FolderOpen className="size-3" style={{ color: 'var(--color-text-muted)' }} />
                  {entry.name}
                </button>
                <button
                  type="button"
                  onClick={() => setSaved(removeSavedManifest(entry.id, activeNetwork))}
                  title={t.deleteHint}
                  className="p-1 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
