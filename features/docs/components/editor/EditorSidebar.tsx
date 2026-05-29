'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, FileText, Tag, User } from 'lucide-react';
import { TOPICS } from '../../data/docsTopics';

import type { DocsEditorDictionary } from '../../types/i18n.types';

/* ─── SidebarLabel ──────────────────────────────────────────────────────── */

function SidebarLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {icon}
      {label}
    </p>
  );
}

/* ─── ToggleSwitch ──────────────────────────────────────────────────────── */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}

function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 w-full text-left"
    >
      <span
        className="relative shrink-0 inline-flex items-center rounded-full transition-colors duration-150"
        style={{
          width: 36,
          height: 20,
          background: checked ? 'var(--color-primary)' : 'var(--color-card-border)',
        }}
      >
        <span
          className="inline-block rounded-full bg-white shadow transition-transform duration-150"
          style={{
            width: 14,
            height: 14,
            transform: checked ? 'translateX(18px)' : 'translateX(3px)',
          }}
        />
      </span>
      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
    </button>
  );
}

/* ─── EditorSidebar ─────────────────────────────────────────────────────── */

interface EditorSidebarProps {
  t: DocsEditorDictionary;
  topicLabels: Record<string, string>;
  selectedTopic: string;
  onTopicChange: (id: string) => void;
  topicOpen: boolean;
  setTopicOpen: (open: boolean) => void;
  tags: string;
  onTagsChange: (val: string) => void;
  showAuthor: boolean;
  onShowAuthorChange: (val: boolean) => void;
  authorName: string;
  onAuthorNameChange: (val: string) => void;
  counts: { words: number; chars: number };
  onImportMd: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  isEditMode: boolean;
  navbarHeight: number;
}

export function EditorSidebar({
  t,
  topicLabels,
  selectedTopic,
  onTopicChange,
  topicOpen,
  setTopicOpen,
  tags,
  onTagsChange,
  showAuthor,
  onShowAuthorChange,
  authorName,
  onAuthorNameChange,
  counts,
  onImportMd,
  onSaveDraft,
  onPublish,
  isEditMode,
  navbarHeight,
}: EditorSidebarProps) {
  const selectableTopics = TOPICS.filter(item => item.id !== 'admin');

  return (
    <div
      className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l flex flex-col bg-inherit"
      style={{
        borderColor: 'var(--color-card-border)',
        height: `calc(100dvh - ${navbarHeight}px)`,
        position: 'sticky',
        top: navbarHeight,
      }}
    >
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Category */}
        <div>
          <SidebarLabel
            icon={<FileText className="size-3" />}
            label={t.topic_label ?? 'Category'}
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setTopicOpen(!topicOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            >
              <span>{topicLabels?.[selectedTopic] ?? selectedTopic}</span>
              <ChevronDown
                className="size-4 transition-transform duration-150"
                style={{
                  color: 'var(--color-text-muted)',
                  transform: topicOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>
            <AnimatePresence>
              {topicOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute inset-x-0 top-full mt-1 z-20 rounded-xl shadow-xl overflow-hidden"
                  style={{
                    background: 'var(--color-card-bg)',
                    border: '1px solid var(--color-card-border)',
                  }}
                >
                  {selectableTopics.map(topic => {
                    const active = selectedTopic === topic.id;
                    return (
                      <button
                        type="button"
                        key={topic.id}
                        onClick={() => {
                          onTopicChange(topic.id);
                          setTopicOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left transition-colors hover:bg-[var(--color-surface)]"
                        style={{
                          color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          background: active ? 'var(--color-surface)' : 'transparent',
                        }}
                      >
                        <span
                          style={{
                            color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          }}
                        >
                          {topic.icon}
                        </span>
                        {topicLabels?.[topic.topicKey] ?? topic.topicKey}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tags */}
        <div>
          <SidebarLabel icon={<Tag className="size-3" />} label={t.tags_label ?? 'Tags'} />
          <input
            type="text"
            value={tags}
            onChange={e => onTagsChange(e.target.value)}
            placeholder={t.tags_placeholder ?? 'tag1, tag2…'}
            aria-label={t.tags_label ?? 'Tags'}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          />
        </div>

        {/* Author Settings */}
        <div className="space-y-4">
          <SidebarLabel icon={<User className="size-3" />} label="Autor" />
          <ToggleSwitch
            checked={showAuthor}
            onChange={onShowAuthorChange}
            label={t.show_author_label ?? 'Show author name'}
          />
          <AnimatePresence>
            {showAuthor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <input
                  type="text"
                  value={authorName}
                  onChange={e => onAuthorNameChange(e.target.value)}
                  placeholder={t.author_name_placeholder ?? 'Your name…'}
                  aria-label={t.show_author_label ?? 'Show author name'}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-card-border)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats */}
        <div className="pt-2 border-t" style={{ borderColor: 'color-mix(in srgb, var(--color-card-border) 40%, transparent)' }}>
          <div className="grid grid-cols-2 gap-3">
            {[
              [t.word_count ?? 'Words', counts.words],
              [t.char_count ?? 'Characters', counts.chars],
            ].map(([label, val]) => (
              <div
                key={label}
                className="px-3 py-2.5 rounded-xl text-center"
                style={{ background: 'var(--color-surface)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {label}
                </p>
                <p className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
                  {val}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 space-y-3 bg-inherit">
        <button
          type="button"
          onClick={onImportMd}
          className="w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', color: 'var(--color-text-main)' }}
        >
          {t.import_md_title ?? 'Import .md'}
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          className="w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', color: 'var(--color-text-main)' }}
        >
          {t.save_draft ?? 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={onPublish}
          className="w-full px-4 py-1.5 min-h-[44px] rounded-xl text-sm font-bold transition-all hover:opacity-90 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          style={{ background: 'var(--color-primary)', color: 'var(--color-bg)' }}
        >
          {isEditMode ? t.update_btn ?? 'Update' : t.publish_btn ?? 'Publish'}
        </button>
      </div>
    </div>
  );
}
