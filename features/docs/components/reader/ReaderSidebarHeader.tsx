import React from 'react';
import { MarkdownButton } from '@/components/ui/MarkdownButton';
import { ShareButton } from '@/components/ui/ShareButton';
import { PrintButton } from '@/components/ui/PrintButton';

interface ReaderSidebarHeaderProps {
  title: string;
  shareLabel: string;
  printLabel: string;
  downloadLabel: string;
  copiedLabel: string;
  onDownloadMarkdown: () => void;
}

export function ReaderSidebarHeader({
  title,
  shareLabel,
  printLabel,
  downloadLabel,
  copiedLabel,
  onDownloadMarkdown,
}: ReaderSidebarHeaderProps) {
  return (
    <div
      className="relative flex items-center mb-4 pb-3 border-b"
      style={{ borderColor: 'var(--color-card-border)' }}
    >
      <p
        className="text-xs font-bold uppercase tracking-widest truncate pr-2"
        style={{ color: 'var(--color-primary)' }}
        title={title}
      >
        {title}
      </p>
      <div className="absolute left-full top-[-4px] ml-3 flex items-center gap-1.5 pointer-events-auto">
        <MarkdownButton title={downloadLabel} onClick={onDownloadMarkdown} />
        <ShareButton title={shareLabel} copiedLabel={copiedLabel} />
        <PrintButton title={printLabel} />
      </div>
    </div>
  );
}
