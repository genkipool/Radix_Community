'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
  url?: string;
  title: string;
  copiedLabel: string;
}

export function ShareButton({ url, title, copiedLabel }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const targetUrl = url || window.location.href;
    navigator.clipboard.writeText(targetUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1, translateY: -2 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleShare}
      title={copied ? copiedLabel : title}
      className="size-8 flex items-center justify-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)]/40 backdrop-blur-md text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-colors shadow-sm relative"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            <Check className="size-4 text-green-500" />
          </motion.div>
        ) : (
          <motion.div
            key="share"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
          >
            <Share2 className="size-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
