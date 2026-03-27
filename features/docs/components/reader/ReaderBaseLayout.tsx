'use client';

import React from 'react';
import type { ReaderBaseLayoutProps } from '../../types/components.types';
import '../../styles/reader.css';

export function ReaderBaseLayout({
  children,
  sidebarHeader,
  sidebarContent,
  breadcrumb,
  title,
  subtitle,
  publishDate,
  author,
  showAuthor,
}: ReaderBaseLayoutProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
      <div className="flex flex-col lg:flex-row gap-12 xl:gap-20">

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 py-10">

          {/* Breadcrumb + Date row */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2 no-print">
            <div className="inline-flex items-center text-sm font-semibold tracking-wide flex-wrap gap-1"
              style={{ color: 'var(--color-primary)' }}>
              {breadcrumb}
            </div>
            {(publishDate || (showAuthor && author)) && (
              <div className="flex flex-col items-end gap-0.5">
                {showAuthor && author && (
                  <span className="text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                    {author}
                  </span>
                )}
                {publishDate && (
                  <time className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {typeof publishDate === 'number'
                      ? new Date(publishDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                      : publishDate
                    }
                  </time>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-8"
            style={{ color: 'var(--color-text-main)' }}>
            {title}
          </h1>

          {/* Intro / Subtitle */}
          {subtitle && (
            <div className="text-xl leading-relaxed mb-10" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </div>
          )}

          {/* Main Body */}
          <div className="docs-reader-content">
            {children}
          </div>
        </div>

        {/* ── Right ToC Sidebar ── */}
        <div
          className="hidden lg:block w-56 xl:w-64 shrink-0 sticky self-start pt-[39px] pb-10 reader-sidebar"
          style={{
            top: '5rem',
            height: 'calc(100vh - 5rem)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header (not scrollable, so absolute buttons can overflow horizontally) */}
          <div className="shrink-0 relative">
            {sidebarHeader}
          </div>
          
          {/* Content (scrollable) */}
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {sidebarContent}
          </div>
        </div>

      </div>
    </div>
  );
}
