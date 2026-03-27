'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { DOCS_MAP } from '../data/docsData';
import type { DocReaderViewProps } from '../types/components.types';
import type { DocsDictionary } from '../types/i18n.types';
import { Highlight } from './DocsSidebar';
import { useReaderToC } from '../hooks/useReaderToC';
import { ReaderBaseLayout } from './reader/ReaderBaseLayout';
import { ReaderTocItem, ReaderDocSection, ReaderDocCallout } from './reader/ReaderUI';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderSidebarHeader } from './reader/ReaderSidebarHeader';
import { downloadAsMarkdown } from '../utils/markdownDownload';
import { CodeHighlighter } from '@/components/ui/CodeHighlighter';

export default function DocReaderView({ docId, onTopicClick, searchQuery = '' }: DocReaderViewProps) {
  const { t: dict } = useLanguage();
  const t = dict.docs as DocsDictionary;
  const content = t.content ?? {};
  const documents = t.documents ?? {};
  const topics = t.topics ?? {};
  const actions = t.actions ?? {};

  const doc = DOCS_MAP[docId];
  const docTitle = doc ? (documents[doc.titleKey] ?? doc.titleKey) : docId;
  const topicLabel = doc ? (topics[doc.topicKey] ?? doc.topicKey) : '';
  const topicId = doc?.topicId ?? '';

  const rawToc = doc?.toc ?? [];
  const readerToc = rawToc.map(entry => ({
    id: entry.id,
    text: content[entry.titleKey] ?? entry.titleKey,
    level: entry.level,
  }));

  const { activeId } = useReaderToC(readerToc, docId);

  const handleDownloadMarkdown = () => {
    if (!doc) return;
    downloadAsMarkdown(docTitle, { toc: doc.toc, dictContent: content });
  };

  const breadcrumb = (
    <ReaderHeader
      topicLabel={topicLabel}
      docTitle={docTitle}
      topicAction={topicLabel ? (
        <button
          onClick={() => onTopicClick(topicId)}
          className="transition-all duration-150"
          style={{ color: 'var(--color-primary)' }}
          title="Expand category"
        >
          {topicLabel}
        </button>
      ) : undefined}
    />
  );

  const sidebarHeader = (
    <ReaderSidebarHeader
      title={docTitle}
      shareLabel={actions.share ?? 'Share'}
      printLabel={actions.print ?? 'Print'}
      downloadLabel={actions.download_md ?? 'Download Markdown'}
      copiedLabel={actions.copied ?? 'Copied!'}
      onDownloadMarkdown={handleDownloadMarkdown}
    />
  );

  const sidebarContent = (
    <nav>
      {readerToc.map(entry => (
        <ReaderTocItem
          key={entry.id}
          entry={entry}
          isActive={activeId === entry.id}
        />
      ))}
    </nav>
  );

  return (
    <ReaderBaseLayout
      breadcrumb={breadcrumb}
      title={<Highlight text={docTitle} query={searchQuery} />}
      subtitle={<Highlight text={content.ledger_intro ?? ''} query={searchQuery} />}
      publishDate={doc?.publishedAt}
      sidebarHeader={sidebarHeader}
      sidebarContent={sidebarContent}
    >
      {rawToc.map((entry, idx) => (
        <div key={entry.id}>
          <ReaderDocSection
            id={entry.id}
            title={content[entry.titleKey] ?? entry.titleKey}
            level={entry.level}
            searchQuery={searchQuery}
          />
          <div className="mb-6" style={{ color: 'var(--color-text-muted)' }}>
            <CodeHighlighter html={content[entry.bodyKey] ?? ''} />
          </div>
          {idx === 0 && entry.level === 2 && (
            <ReaderDocCallout title={t.editor?.callout_epochs ?? 'Epochs'}>
              <CodeHighlighter html={content.callout_epochs_body ?? ''} />
            </ReaderDocCallout>
          )}
        </div>
      ))}
    </ReaderBaseLayout>
  );
}
