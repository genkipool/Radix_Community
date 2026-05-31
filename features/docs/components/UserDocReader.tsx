'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import type { UserDocReaderProps } from '../types/components.types';
import type { DocsDictionary } from '../types/i18n.types';
import { injectHeadingIds } from '@/features/docs/utils/htmlToc';
import { sanitizeUserHtml } from '@/utils/sanitize';
import { useReaderToC } from '../hooks/useReaderToC';
import { ReaderBaseLayout } from './reader/ReaderBaseLayout';
import { ReaderTocItem } from './reader/ReaderUI';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderSidebarHeader } from './reader/ReaderSidebarHeader';
import { downloadAsMarkdown } from '../utils/markdownDownload';
import { applyMarkdownToHtml } from '../utils/markdownParser';
import { CodeHighlighter } from '@/components/ui/CodeHighlighter';

export default function UserDocReader({ doc, dictionary }: UserDocReaderProps) {
  const { t: dictContext } = useLanguage();
  const dict = dictionary || dictContext;
  const docsT = (dict?.docs as DocsDictionary) || {};
  const topicLabels = docsT.topics || {};

  /* Process HTML: parse embedded markdown universally */
  const rawContent = applyMarkdownToHtml(doc.html);
  const sanitized = sanitizeUserHtml(rawContent);
  const { html, toc } = injectHeadingIds(sanitized);

  const { processedHtml, readerToc } = {
    processedHtml: html.replace(/<(h[1-6])[^>]*>(\s*#+\s*)+/gi, (match, tag) => `<${tag}>`),
    readerToc: toc.map(it => ({
      id: it.id,
      text: it.text,
      level: it.level,
    })),
  };

  const { activeId } = useReaderToC(readerToc, doc.id);

  const topicLabel = topicLabels?.[doc.topic] ?? doc.topic;
  const actions = docsT.actions ?? {};

  const handleDownloadMarkdown = () => {
    downloadAsMarkdown(doc.title, doc.html);
  };

  const breadcrumb = (
    <ReaderHeader 
      rootLabel={docsT.community_docs ?? 'Community'} 
      topicLabel={topicLabel} 
      docTitle={doc.title} 
    />
  );

  const sidebarHeader = (
    <ReaderSidebarHeader
      title={doc.title}
      shareLabel={actions.share ?? 'Share'}
      printLabel={actions.print ?? 'Print'}
      downloadLabel={actions.download_md ?? 'Download Markdown'}
      copiedLabel={actions.copied ?? 'Copied!'}
      onDownloadMarkdown={handleDownloadMarkdown}
    />
  );

  const sidebarContent = (
    <>
      {readerToc.length > 0 && (
        <nav>
          {readerToc.map(item => (
            <ReaderTocItem
              key={item.id}
              entry={item}
              isActive={activeId === item.id}
            />
          ))}
        </nav>
      )}
    </>
  );

  return (
    <ReaderBaseLayout
      sidebarHeader={sidebarHeader}
      sidebarContent={sidebarContent}
      breadcrumb={breadcrumb}
      title={doc.title.replace(/^#+\s*/, '')}
      publishDate={doc.publishedAt}
      author={doc.author}
      showAuthor={doc.showAuthor}
    >
      <div className="doc-content-body prose prose-invert max-w-none">
        <CodeHighlighter html={processedHtml} />
      </div>
    </ReaderBaseLayout>
  );
}
