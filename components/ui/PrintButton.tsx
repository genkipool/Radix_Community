'use client';
import React from 'react';
import { motion } from 'motion/react';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  title: string;
}

export function PrintButton({ title }: PrintButtonProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1, translateY: -2 }}
      whileTap={{ scale: 0.9 }}
      onClick={handlePrint}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)]/40 backdrop-blur-md text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-colors shadow-sm"
    >
      <Printer className="w-4 h-4" />
    </motion.button>
  );
}
