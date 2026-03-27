'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, History } from 'lucide-react';
import type { DraftData, ToastMsg } from '../../types/components.types';

import type { DocsEditorDictionary } from '../../types/i18n.types';

/* ─── DraftRecoveryBanner ────────────────────────────────────────────────── */

interface DraftRecoveryBannerProps {
  draft: DraftData;
  t: DocsEditorDictionary;
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryBanner({
  draft,
  t,
  onRestore,
  onDiscard,
}: DraftRecoveryBannerProps) {
  const time = new Date(draft.savedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="flex items-center justify-between gap-4 px-5 py-3 mx-4 mt-4 rounded-xl text-sm"
      style={{
        background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-card-bg))',
        border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <History className="w-4 h-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
        <span style={{ color: 'var(--color-text-main)' }}>
          <span className="font-semibold">{t.draft_recovery_title ?? 'Draft found'}</span>
          <span className="ml-1.5 opacity-60 text-xs">
            — {t.draft_last_saved ?? 'Last saved'} {time}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRestore}
          className="px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
          style={{ background: 'var(--color-primary)', color: 'var(--color-bg)' }}
        >
          {t.draft_restore ?? 'Restore'}
        </button>
        <button
          onClick={onDiscard}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-card-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          {t.draft_discard_btn ?? 'Discard'}
        </button>
      </div>
    </motion.div>
  );
}

/* ─── ToastList ──────────────────────────────────────────────────────────── */

interface ToastListProps {
  toasts: ToastMsg[];
}

export function ToastList({ toasts }: ToastListProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[201] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold pointer-events-auto"
            style={{
              background:
                t.type === 'success'
                  ? '#16a34a'
                  : t.type === 'error'
                  ? '#dc2626'
                  : 'var(--color-primary)',
              color: '#fff',
            }}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
