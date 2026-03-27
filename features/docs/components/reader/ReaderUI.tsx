'use client';

import React from 'react';
import Link from 'next/link';
import { Hash } from 'lucide-react';
import { Highlight } from '../DocsSidebar';
import type { ReaderTocItemProps, ActionButtonProps, DocSectionProps, DocCalloutProps } from '../../types/components.types';

export function ActionButton({ children, title, onClick }: ActionButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-2 rounded-full transition-colors"
      style={{ color: 'var(--color-text-muted)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
        (e.currentTarget as HTMLButtonElement).style.background = '';
      }}
    >
      {children}
    </button>
  );
}

export function ReaderTocItem({ entry, isActive }: ReaderTocItemProps) {
  const indent = entry.level === 2 ? 'pl-0' : entry.level === 3 ? 'pl-3.5' : 'pl-6';
  const size = entry.level === 4 ? 'text-xs' : 'text-sm';
  const weight = entry.level === 2 ? 'font-semibold' : 'font-medium';

  return (
    <Link
      href={`#${entry.id}`}
      className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all duration-200 ${indent} ${size} ${weight}`}
      style={{
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
        background: isActive ? 'var(--color-surface)' : 'transparent',
        opacity: isActive ? 1 : entry.level === 2 ? 0.9 : entry.level === 3 ? 0.72 : 0.55,
        borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
        paddingLeft: isActive
          ? (entry.level === 2 ? '6px' : entry.level === 3 ? '14px' : '22px')
          : undefined,
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: isActive ? (entry.level === 2 ? 7 : entry.level === 3 ? 5 : 4) : (entry.level === 2 ? 6 : entry.level === 3 ? 4 : 3),
          height: isActive ? (entry.level === 2 ? 7 : entry.level === 3 ? 5 : 4) : (entry.level === 2 ? 6 : entry.level === 3 ? 4 : 3),
          background: isActive ? 'var(--color-primary)' : 'currentColor',
          transition: 'all 0.2s',
        }}
      />
      {entry.text}
    </Link>
  );
}

export function ReaderDocSection({ id, title, level = 2, searchQuery = '' }: DocSectionProps) {
  const Tag = level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
  const sizeClass =
    level === 2 ? 'text-2xl font-bold mt-12 mb-4'
      : level === 3 ? 'text-xl font-semibold mt-9 mb-3'
        : 'text-base font-semibold mt-6 mb-2';

  return (
    <Tag
      id={id}
      className={`flex items-center group ${sizeClass}`}
      style={{ color: 'var(--color-text-main)', scrollMarginTop: '5rem' }}
    >
      <Hash
        className="mr-2 opacity-0 group-hover:opacity-40 transition-opacity shrink-0"
        style={{
          width: level === 4 ? 14 : 18,
          height: level === 4 ? 14 : 18,
          color: 'var(--color-primary)',
        }}
      />
      <Highlight text={title} query={searchQuery} />
    </Tag>
  );
}

export function ReaderDocCallout({ title, children }: DocCalloutProps) {
  return (
    <div
      className="my-8 p-5 rounded-2xl border"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-card-border)',
        borderLeft: '3px solid var(--color-primary)',
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-primary)' }}>
        {title}
      </p>
      <div className="m-0 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </div>
    </div>
  );
}
