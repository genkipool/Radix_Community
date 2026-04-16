'use client';

/**
 * features/dashboard/components/DashboardModals.tsx
 *
 * Renders all three modal layers of the dashboard:
 *   1. Reading-mode validator modal
 *   2. Reading-mode transaction modal
 *   3. Resource detail modal (token info)
 *
 * Fully controlled — all state lives in DashboardClient.
 */

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { FloatingNav } from '@/components/ui/FloatingNav';
import { ValidatorDetailView } from '../staking';
import { TransactionDetailModal } from '../explorador';

import type { DashboardModalsProps } from '../types';

export const DashboardModals = ({
  activeView,
  readingMode,
  expandedPost,
  filteredValidators,
  expandedTx,
  filteredTxs,
  closeExpanded,
  setExpandedPosts,
  t,
  dt,
  copiedAddress,
  copyAddress,
  network,
  direction,
  setDirection,
  timezone,
  locale,
}: DashboardModalsProps) => {

  return (
  <>
    {/* ── Validator reading-mode modal ── */}
    {/* initial={false}: if the modal is already open when AnimatePresence first
        renders (restored from cookie after a reload), the entrance animation is
        suppressed — modal appears instantly with no flash or close/reopen.
        User-triggered opens (modal was absent on first render) still animate
        normally because AnimatePresence only suppresses initial on its first render. */}
    <AnimatePresence initial={false}>
      {readingMode && activeView === 'staking' && expandedPost && (
        <React.Fragment key="validator-modal">
          <ModalOverlay onClose={closeExpanded} blur="sm" />
          <motion.div
            key="validator-modal-motion"
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto"
            onClick={closeExpanded}
          >
            <FloatingNav
              hasPrev={filteredValidators.findIndex(v => v.id === expandedPost.id) > 0}
              hasNext={filteredValidators.findIndex(v => v.id === expandedPost.id) < filteredValidators.length - 1}
              onPrev={() => {
                setDirection(-1);
                const idx = filteredValidators.findIndex(v => v.id === expandedPost.id);
                if (idx > 0) setExpandedPosts(new Set([filteredValidators[idx - 1].id]));
              }}
              onNext={() => {
                setDirection(1);
                const idx = filteredValidators.findIndex(v => v.id === expandedPost.id);
                if (idx < filteredValidators.length - 1) setExpandedPosts(new Set([filteredValidators[idx + 1].id]));
              }}
              prevLabel={t?.dashboard?.reading?.previous_post || 'Anterior'}
              nextLabel={t?.dashboard?.reading?.next_post || 'Siguiente'}
              className="hidden sm:flex"
            />

            <div className="w-full max-w-[1600px] mx-auto pointer-events-auto">
              <ValidatorDetailView
                validator={expandedPost}
                onClose={closeExpanded}
                direction={direction}
                setDirection={setDirection}
                onPrev={(() => {
                  const idx = filteredValidators.findIndex(v => v.id === expandedPost.id);
                  const prevPost = idx > 0 ? filteredValidators[idx - 1] : null;
                  return prevPost ? () => { setDirection(-1); setExpandedPosts(new Set([prevPost.id])); } : undefined;
                })()}
                onNext={(() => {
                  const idx = filteredValidators.findIndex(v => v.id === expandedPost.id);
                  const nextPost = idx < filteredValidators.length - 1 ? filteredValidators[idx + 1] : null;
                  return nextPost ? () => { setDirection(1); setExpandedPosts(new Set([nextPost.id])); } : undefined;
                })()}
                t={t}
                dt={dt}
                copiedAddress={copiedAddress}
                copyAddress={copyAddress}
                network={network}
              />
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>

    {/* ── Transaction reading-mode modal ── */}
    <AnimatePresence initial={false}>
      {readingMode && activeView === 'transactions' && expandedTx && (
        <React.Fragment key="transaction-modal">
          <ModalOverlay onClose={closeExpanded} blur="sm" />
          <TransactionDetailModal
            key="transaction-modal-content"
            tx={expandedTx}
            onClose={closeExpanded}
            onPrev={(() => {
              const idx = filteredTxs.findIndex(tx => tx.intentHash === expandedTx.intentHash);
              const prevTx = idx > 0 ? filteredTxs[idx - 1] : null;
              return prevTx ? () => { setDirection(-1); setExpandedPosts(new Set([prevTx.intentHash])); } : undefined;
            })()}
            onNext={(() => {
              const idx = filteredTxs.findIndex(tx => tx.intentHash === expandedTx.intentHash);
              const nextTx = idx < filteredTxs.length - 1 ? filteredTxs[idx + 1] : null;
              return nextTx ? () => { setDirection(1); setExpandedPosts(new Set([nextTx.intentHash])); } : undefined;
            })()}
            prevTxHash={(() => {
              const idx = filteredTxs.findIndex(tx => tx.intentHash === expandedTx.intentHash);
              return idx > 0 ? filteredTxs[idx - 1].intentHash : undefined;
            })()}
            nextTxHash={(() => {
              const idx = filteredTxs.findIndex(tx => tx.intentHash === expandedTx.intentHash);
              return idx < filteredTxs.length - 1 ? filteredTxs[idx + 1].intentHash : undefined;
            })()}
            t={t}
            dt={dt}
            copiedAddress={copiedAddress}
            copyAddress={copyAddress}
            network={network}
            direction={direction}
            setDirection={setDirection}
            timezone={timezone}
            locale={locale}
          />
        </React.Fragment>
      )}
    </AnimatePresence>
  </>
);
}