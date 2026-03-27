'use client';
/**
 * WalletFloatingBadges — Client Component (boundary)
 *
 * Owns the two looping motion.div animations in the Wallet section mockup.
 * By extracting them here, Wallet.tsx becomes a pure RSC.
 */
import { motion } from 'motion/react';
import type { WalletFloatingBadgesProps } from '../../../types';

export default function WalletFloatingBadges({ t }: WalletFloatingBadgesProps) {
  return (
    <>
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-20 -right-10 bg-[var(--color-card-border)] backdrop-blur-md border border-[var(--color-card-border)] p-4 rounded-2xl shadow-xl z-20"
      >
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-xl max-w-[200px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
              RX
            </div>
            <div className="text-white">
              <div className="font-bold text-sm leading-tight mb-1">{t.wallet.mockup.personaTitle}</div>
              <div className="text-[11px] opacity-80 leading-normal">{t.wallet.mockup.personaDesc}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
