'use client';

import React, { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface ReaderHeaderProps {
  rootLabel?: string;
  topicLabel: string;
  docTitle: string;
  topicAction?: ReactNode;
}

export function ReaderHeader({ rootLabel, topicLabel, docTitle, topicAction }: ReaderHeaderProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 overflow-hidden whitespace-nowrap">
      {rootLabel && (
        <>
          <span>{rootLabel}</span>
          <ChevronRight className="size-4 opacity-50 shrink-0" />
        </>
      )}
      {topicAction ? (
        topicAction
      ) : (
        <span className="opacity-80">{topicLabel}</span>
      )}
      <ChevronRight className="size-4 opacity-50 shrink-0" />
      <span className="truncate" style={{ color: 'var(--color-text-main)' }}>
        {docTitle.replace(/^#+\s*/, '')}
      </span>
    </div>
  );
}
