'use client';

import React, {
  useEffect, useRef, useState,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Upload, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import EditorToolbar from '@/components/ui/RichTextEditor/EditorToolbar';
import { LinkDialog } from '@/components/ui/RichTextEditor/EditorDialogs';
import { useFormattingState } from '@/components/ui/RichTextEditor/useFormattingState';
import { useRichTextLogic } from '@/components/ui/RichTextEditor/hooks/useRichTextLogic';
import { markdownToHtml, applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';
import { sanitizeUserHtml } from '@/utils/sanitize';
import type { DocsEditorProps } from '../types/components.types';
import type { DocsDictionary } from '../types/i18n.types';
import { useEditorState } from '../hooks/useEditorState';
import { EditorSidebar } from './editor/EditorSidebar';
import { ToastList, DraftRecoveryBanner } from './editor/EditorNotifications';

// Utils & Constants
import { NAVBAR_H } from '../constants';

// Styles
import '../styles/editor.css';

export default function DocsEditor({ onClose, onPublish, initialDoc }: DocsEditorProps) {
  const { t: dict } = useLanguage();
  const docsT = dict.docs as DocsDictionary;
  const editorT = (docsT.editor ?? {}) as Record<string, string>;
  const topicLabels = docsT.topics;

  const editorRef = useRef<HTMLDivElement>(null);
  const htmlRef = useRef<string>('<p><br></p>');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  const {
    title, setTitle,
    selectedTopic, setSelectedTopic,
    tags, setTags,
    showAuthor, setShowAuthor,
    authorName, setAuthorName,
    toasts, addToast,
    pendingDraft,
    counts, updateCounts,
    handleSaveDraft: apiSaveDraft,
    handleRestoreDraft: apiRestoreDraft,
    handleDiscardDraft,
    preparePublishDoc,
  } = useEditorState(initialDoc);

  const [topicOpen, setTopicOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  const isEditMode = !!initialDoc;
  const { state: formatState, forceUpdate } = useFormattingState(editorRef);

  const {
    showLinkDialog,
    setShowLinkDialog,
    execCmd,
    saveSelection,
    restoreSelection,
    handleBlockType,
    handleInsertLink,
    handleInsertCodeBlock,
    handleImageFileChange,
    handlePaste,
    handleDrop,
    handleEditorClick,
    syncHtmlOnInput,
    handleKeyDown
  } = useRichTextLogic({
    editorRef,
    onSync: (html: string) => {
      htmlRef.current = html;
      updateCounts(html);
    },
    forceUpdate,
    t: editorT,
    maxLength: 100000, // Example limit for docs
    addToast
  });

  // Sync initial content
  const contentSyncedRef = useRef(false);
  if (!contentSyncedRef.current && editorRef.current) {
    contentSyncedRef.current = true;
    const initial = initialDoc?.html || '<p><br></p>';
    editorRef.current.innerHTML = initial;
    htmlRef.current = initial;
    if (initial !== '<p><br></p>') updateCounts(initial);
  }

  // Command & Sync helpers
  const handleMarkdownImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const html = markdownToHtml(text);
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
      htmlRef.current = html;
      updateCounts(html);
    }
    const h1 = text.match(/^# (.+)/m);
    if (h1?.[1] && !title) setTitle(h1[1]);
    e.target.value = '';
  };
  const handleFontSize = (size: '1' | '3' | '5') => execCmd('fontSize', size);
  const handleForeColor = (c: string) => { restoreSelection(); execCmd('foreColor', c); };
  const handleHiliteColor = (c: string) => { restoreSelection(); execCmd('hiliteColor', c); };

  const handlePublishClick = () => {
    const doc = preparePublishDoc(htmlRef.current);
    if (!doc) return;
    if (!doc.title) {
      addToast('error', editorT.title_placeholder ?? 'Please add a title.');
      return;
    }
    if (!doc.html.replace(/<[^>]*>/g, '').trim()) {
      addToast('error', editorT.content_placeholder ?? 'Content cannot be empty.');
      return;
    }
    onPublish?.(doc);
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} aria-label="Upload image" />
      <input ref={mdInputRef} type="file" accept=".md,.markdown,text/plain" className="hidden" onChange={handleMarkdownImport} aria-label="Import markdown" />

      <ToastList toasts={toasts} />

      <AnimatePresence>
        {showLinkDialog && (
          <LinkDialog key="link" onInsert={handleInsertLink} onClose={() => setShowLinkDialog(false)} t={editorT} />
        )}
      </AnimatePresence>

      <div
        className="w-full flex flex-col"
        style={{ background: 'var(--color-bg)', minHeight: `calc(100dvh - ${NAVBAR_H}px)` }}
      >
        <AnimatePresence>
          {pendingDraft && (
            <DraftRecoveryBanner
              key="dr"
              draft={pendingDraft}
              t={editorT}
              onRestore={() => apiRestoreDraft(html => {
                if (editorRef.current) {
                  editorRef.current.innerHTML = html;
                  htmlRef.current = html;
                  updateCounts(html);
                }
              })}
              onDiscard={handleDiscardDraft}
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row flex-1">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="relative px-6 sm:px-10 xl:px-16 pt-4 pb-5 border-b" style={{ borderColor: 'var(--color-card-border)' }}>
              <div className="relative group">
                <input
                  type="text"
                  value={title}
                  maxLength={85}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={editorT.title_placeholder ?? 'Document title…'}
                  aria-label={editorT.title_placeholder ?? 'Document title…'}
                  className="w-full text-3xl sm:text-4xl font-extrabold bg-transparent focus:outline-none tracking-tight leading-tight pr-20"
                  style={{ color: 'var(--color-text-main)', caretColor: 'var(--color-primary)' }}
                />
                <div
                  className={`absolute right-0 bottom-1 text-xs font-mono transition-opacity ${title.length > 70 ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-40'}`}
                  style={{ color: title.length >= 85 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                >
                  {title.length}/85
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={editorT.close ?? 'Close editor'}
                title={editorT.close ?? 'Close editor'}
                className="absolute top-6 right-6 size-8 flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', color: 'var(--color-text-muted)' }}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="sticky z-20" style={{ top: NAVBAR_H }}>
              <EditorToolbar
                formatState={formatState}
                onCommand={execCmd}
                onBlockType={handleBlockType}
                onInsertLink={() => { saveSelection(); setShowLinkDialog(true); }}
                onInsertCodeBlock={handleInsertCodeBlock}
                onInsertImage={() => fileInputRef.current?.click()}
                onFontSize={handleFontSize}
                onForeColor={handleForeColor}
                onHiliteColor={handleHiliteColor}
                t={editorT}
                previewMode={previewMode}
                onTogglePreview={() => {
                  if (!previewMode && editorRef.current) {
                    setPreviewContent(editorRef.current.innerHTML);
                  }
                  setPreviewMode(!previewMode);
                }}
              />
            </div>

            <div
              className="relative flex-1"
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <AnimatePresence>
                {(isDragOver && !previewMode) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none m-4 rounded-2xl"
                    style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', border: '2px dashed var(--color-primary)' }}>
                    <Upload className="size-10" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {editorT.drop_image ?? 'Drop image here'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {previewMode && (
                <div
                  className="docs-editor-content w-full min-h-[500px] px-6 sm:px-10 xl:px-16 py-8 custom-scrollbar overflow-y-auto prose prose-invert max-w-none"
                  style={{
                    color: 'var(--color-text-main)',
                    lineHeight: '1.85',
                    fontSize: '1rem'
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(applyMarkdownToHtml(previewContent)) }}
                />
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncHtmlOnInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onClick={handleEditorClick}
                data-placeholder={editorT.content_placeholder ?? 'Start writing…'}
                className={`docs-editor-content w-full min-h-[500px] px-6 sm:px-10 xl:px-16 py-8 focus:outline-none ${previewMode ? 'hidden' : ''}`}
                style={{ color: 'var(--color-text-main)', lineHeight: '1.85', fontSize: '1rem', caretColor: 'var(--color-primary)' }}
              />
            </div>
          </div>

          <EditorSidebar
            t={editorT}
            topicLabels={topicLabels || {}}
            selectedTopic={selectedTopic}
            onTopicChange={setSelectedTopic}
            topicOpen={topicOpen}
            setTopicOpen={setTopicOpen}
            tags={tags}
            onTagsChange={setTags}
            showAuthor={showAuthor}
            onShowAuthorChange={setShowAuthor}
            authorName={authorName}
            onAuthorNameChange={setAuthorName}
            counts={counts}
            onImportMd={() => mdInputRef.current?.click()}
            onSaveDraft={() => apiSaveDraft(htmlRef.current, editorT)}
            onPublish={handlePublishClick}
            isEditMode={isEditMode}
            navbarHeight={NAVBAR_H}
          />
        </div>
      </div>
    </>
  );
}
