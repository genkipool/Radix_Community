'use client';
import React from 'react';
import { m } from "motion/react";
import { FileText } from 'lucide-react';

interface MarkdownButtonProps {
  onClick: () => void;
  title: string;
}

export function MarkdownButton({ onClick, title }: MarkdownButtonProps) {
  return (
    <m.button
      whileHover={{ scale: 1.1, translateY: -2 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={title}
      className="size-8 flex items-center justify-center rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)]/40 backdrop-blur-md text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-colors shadow-sm"
    >
      <FileText className="size-4" />
    </m.button>
  );
}
