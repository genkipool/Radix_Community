'use client';

import { useState, useRef } from 'react';
import { UserDocSchema, type UserDoc } from '../types/data.types';
import type { DraftData, ToastMsg } from '../types/components.types';
import { sanitizeUserHtml } from '@/utils/sanitize';
import type { DocsDictionary } from '../types/i18n.types';

const DRAFT_KEY = 'docs_editor_draft';

function countWords(html: string) {
  const t = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return { words: t ? t.split(' ').length : 0, chars: t.length };
}

const saveDraftToStorage = (d: DraftData) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* quota */
  }
};

const loadDraftFromStorage = (): DraftData | null => {
  try {
    const r = localStorage.getItem(DRAFT_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
};

const clearDraftFromStorage = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
};

export function useEditorState(initialDoc?: UserDoc) {
  const [title, setTitle] = useState(initialDoc?.title ?? '');
  const [selectedTopic, setSelectedTopic] = useState(initialDoc?.topic ?? 'developers');
  const [tags, setTags] = useState(initialDoc?.tags ?? '');
  const [showAuthor, setShowAuthor] = useState(initialDoc?.showAuthor ?? false);
  const [authorName, setAuthorName] = useState(initialDoc?.author ?? '');

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  // Initialize pending draft from localStorage during first render (no effect needed)
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(() => {
    if (initialDoc) return null;
    if (typeof window === 'undefined') return null;
    const saved = loadDraftFromStorage();
    if (saved && (saved.title.trim() || saved.html.replace(/<[^>]*>/g, '').trim())) {
      return saved;
    }
    return null;
  });
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const toastIdRef = useRef(0);

  const addToast = (type: ToastMsg['type'], text: string) => {
    const id = ++toastIdRef.current;
    setToasts(p => [...p, { id, type, text }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };

  // Sync state when switching to a different doc (render-time prop comparison)
  const [prevDoc, setPrevDoc] = useState(initialDoc);
  if (initialDoc !== prevDoc) {
    setPrevDoc(initialDoc);
    if (initialDoc) {
      setTitle(initialDoc.title);
      setTags(initialDoc.tags);
      setSelectedTopic(initialDoc.topic);
      setShowAuthor(initialDoc.showAuthor ?? false);
      setAuthorName(initialDoc.author ?? '');
    }
  }

  const handleSaveDraft = (html: string, editorT: DocsDictionary['editor']) => {
    saveDraftToStorage({
      title,
      html: sanitizeUserHtml(html),
      tags,
      topic: selectedTopic,
      savedAt: Date.now(),
    });
    addToast('info', editorT?.draft_saved ?? 'Draft saved.');
  };

  const handleDiscardDraft = () => {
    clearDraftFromStorage();
    setPendingDraft(null);
  };

  const handleRestoreDraft = (setEditorContent: (html: string) => void) => {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setTags(pendingDraft.tags);
    setSelectedTopic(pendingDraft.topic);
    setEditorContent(pendingDraft.html);
    setCounts(countWords(pendingDraft.html));
    setPendingDraft(null);
  };

  const updateCounts = (html: string) => {
    setCounts(countWords(html));
  };

  const preparePublishDoc = (html: string): UserDoc | null => {
    const now = Date.now();
    const docData = {
      id: initialDoc?.id ?? `user-${now}`,
      title: title.trim(),
      topic: selectedTopic,
      html: sanitizeUserHtml(html),
      tags: tags.trim(),
      publishedAt: initialDoc?.publishedAt ?? now,
      updatedAt: initialDoc ? now : undefined,
      showAuthor,
      author: showAuthor ? authorName.trim() : undefined,
    };

    const result = UserDocSchema.safeParse(docData);
    if (!result.success) {
      const msg = result.error.issues[0]?.message || 'Invalid document data';
      addToast('error', msg);
      return null;
    }

    return result.data as UserDoc;
  };

  return {
    title, setTitle,
    selectedTopic, setSelectedTopic,
    tags, setTags,
    showAuthor, setShowAuthor,
    authorName, setAuthorName,
    toasts, addToast,
    pendingDraft,
    counts, updateCounts,
    handleSaveDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    preparePublishDoc,
    clearDraft: clearDraftFromStorage,
  };
}
