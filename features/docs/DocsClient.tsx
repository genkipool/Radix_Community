'use client';

import { useEffect, useState, useTransition, useSyncExternalStore } from 'react';
import DocsSidebar from './components/DocsSidebar';
import { TOPICS } from './data/docsTopics';
import FeaturedDocsHero from './components/FeaturedDocsHero';
import DocReaderView from './components/DocReaderView';
import UserDocReader from './components/UserDocReader';
import dynamic from 'next/dynamic';
import { useLayout } from '@/context/LayoutContext';
import type { UserDoc } from './types/data.types';
import { USER_DOCS_STORAGE_KEY } from './types/data.types';
import { DocsClientProps, UserDocMeta } from './types/components.types';
import { setCookie } from '@/utils/cookies';
import { usePersistentExpandSet } from '@/hooks/usePersistentExpandSet';
import { useSpeedSyncURL } from '@/hooks/useSpeedSyncURL';

/* ── Lazy-load the heavy editor ── */
const DocsEditor = dynamic(() => import('./components/DocsEditor'), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex items-center justify-center py-32">
            <div
                className="size-9 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
            />
        </div>
    ),
});

/* ─── localStorage helpers ─── */
function loadUserDocs(): UserDoc[] {
    try {
        const raw = localStorage.getItem(USER_DOCS_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as UserDoc[]) : [];
    } catch { return []; }
}

function saveUserDocs(docs: UserDoc[]): void {
    try {
        localStorage.setItem(USER_DOCS_STORAGE_KEY, JSON.stringify(docs));

        // Persist sidebar-needed fields (id, title, topic) in a cookie so the server can
        // render the correct initial HTML on reload — eliminates the flash where published
        // cards disappear briefly. Compact keys {i,t,p} keep size under the 4 KB cookie limit.
        const meta = docs.map(d => ({ i: d.id, t: d.title, p: d.topic, d: d.publishedAt, a: d.author, s: d.showAuthor }));
        const metaStr = JSON.stringify(meta);
        setCookie('docs_sidebar_meta', metaStr.length < 3800 ? metaStr : '[]');
    } catch { /* quota */ }
}

const COOKIE_OPEN_TOPICS = 'docs_open_topics';
const EDITOR_VIEW = 'editor';

/* =============================================═════════ */
/*  DocsClient — rendered inside a <Suspense> in page.tsx */
/* =============================================═════════ */
/**
 * Main Docs client component.
 * Manages URL sync, sidebar state, and document selection for the doc explorer.
 */
const EMPTY_USER_DOC_META: UserDocMeta[] = [];

export default function DocsClient({
    initialAutoCollapse = false,
    initialExpandedTopics = '',
    initialUserDocMeta = EMPTY_USER_DOC_META,
    dictionary,
}: DocsClientProps) {

    /* ── Fast URL Sync for selection + editor ── */
    const [viewValue, setViewValue] = useSpeedSyncURL<string>('view');

    // Derived state from stabilized local-first value
    const showEditor = viewValue === EDITOR_VIEW || viewValue?.startsWith('edit:');
    const selectedDocId = showEditor ? null : (viewValue || null);
    const editingDocId = viewValue?.startsWith('edit:') ? viewValue.slice(5) : null;

    const [searchQuery, setSearchQuery] = useState('');
    const [localSearchValue, setLocalSearchValue] = useState('');
    // Initialise from SSR-provided cookie metadata so the server already renders the
    // correct titles in the HTML. On the client, the initialiser reads full data from
    // localStorage directly (same ids/titles — no visual change, no flash).
    const [userDocs, setUserDocs] = useState<UserDoc[]>(() => {
        if (typeof window !== 'undefined') {
            const docs = loadUserDocs();
            if (docs.length > 0) return docs;
        }
        return initialUserDocMeta.map((m: UserDocMeta) => ({
            id: m.id,
            title: m.title,
            topic: m.topic,
            html: '',
            tags: '',
            publishedAt: m.publishedAt || 0,
            author: m.author,
            showAuthor: m.showAuthor,
        }));
    });

    const isMounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false
    );

    const [_isPending, startTransition] = useTransition();
    const { openDeleteDocModal } = useLayout();

    /* ── Shared expand/collapse + cookie persistence ── */
    const {
        expandedIds: expandedTopics,
        autoCollapse,
        handleToggle: handleTopicToggle,
        handleExpandAll,
        handleCollapseAll,
        handleAutoCollapseChange,
        expandAllOnSearch,
    } = usePersistentExpandSet({
        cookieKeyItems: COOKIE_OPEN_TOPICS,
        cookieKeyAutoCollapse: 'docs_auto_collapse',
        allIds: TOPICS.flatMap(t => t.id !== 'admin' ? [t.id] : []),
        defaultExpandAll: false,
        initialAutoCollapse,
        initialExpandedTopics,
    });

    useEffect(() => {
        const docs = loadUserDocs();
        const meta = docs.map(d => ({ i: d.id, t: d.title, p: d.topic, d: d.publishedAt, a: d.author, s: d.showAuthor }));
        const metaStr = JSON.stringify(meta);
        setCookie('docs_sidebar_meta', metaStr.length < 3800 ? metaStr : '[]');
    }, []);

    /* Scroll to top when navigating to a doc (Community technique: behavior: 'instant') */
    useEffect(() => {
        if (viewValue && viewValue !== EDITOR_VIEW && !viewValue.startsWith('edit:')) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [viewValue]);

    /* URL navigation helpers (driven by useSpeedSyncURL) */
    const setView = (val: string | null) => setViewValue(val);

    const handleSelectDoc = (id: string | null) => setView(id);
    const handleOpenEditor = () => setView(EDITOR_VIEW);
    const handleCloseEditor = () => setView(null);
    const handleEditUserDoc = (docId: string) => setView(`edit:${docId}`);
    const handleDeleteUserDoc = (docId: string) => {
        const doc = userDocs.find(d => d.id === docId);
        if (!doc) return;

        openDeleteDocModal(doc.title, () => {
            setUserDocs(prev => {
                const updated = prev.filter(d => d.id === docId ? false : true);
                saveUserDocs(updated);
                return updated;
            });
            if (selectedDocId === docId) {
                setView(null);
            }
        });
    };

    /* Publish / update a community doc */
    const handlePublish = (doc: UserDoc) => {
        setUserDocs(prev => {
            const exists = prev.some(d => d.id === doc.id);
            const updated = exists
                ? prev.map(d => d.id === doc.id ? doc : d)
                : [doc, ...prev];
            saveUserDocs(updated);
            return updated;
        });
        // Expand the topic that contains the new doc and persist it
        const after = new Set(expandedTopics);
        after.add(doc.topic);
        setCookie(COOKIE_OPEN_TOPICS, Array.from(after).join(','));
        handleTopicToggle(doc.topic); // triggers internal state update too
        setView(doc.id);
    };

    const handleSearchQueryChange = (q: string) => {
        setLocalSearchValue(q);
        startTransition(() => {
            setSearchQuery(q);
            if (q.trim()) expandAllOnSearch();
        });
    };

    const selectedUserDoc = selectedDocId ? Object.fromEntries(userDocs.map(d => [d.id, d]))[selectedDocId] : null;
    const editingDoc = editingDocId ? userDocs.find(d => d.id === editingDocId) : undefined;

    return (
        <div
            className="flex flex-col md:flex-row w-full flex-1"
            style={{ background: 'var(--color-bg)', paddingTop: '80px' }}
        >
            <DocsSidebar
                dictionary={dictionary}
                selectedDocId={selectedDocId}
                onSelectDoc={handleSelectDoc}
                expandedTopics={expandedTopics}
                onTopicToggle={handleTopicToggle}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                autoCollapse={autoCollapse}
                onAutoCollapseChange={handleAutoCollapseChange}
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchQueryChange}
                searchValue={localSearchValue}
                onAdminClick={handleOpenEditor}
                isEditorOpen={showEditor}
                userDocs={isMounted ? userDocs : initialUserDocMeta.map((m: UserDocMeta) => ({
                    id: m.id,
                    title: m.title,
                    topic: m.topic,
                    html: '',
                    tags: '',
                    publishedAt: m.publishedAt || 0,
                    author: m.author,
                    showAuthor: m.showAuthor,
                }))}
                onEditUserDoc={handleEditUserDoc}
                onDeleteUserDoc={handleDeleteUserDoc}
                className="h-full"
            />

            <main className="flex-1 relative min-w-0" style={{ overflowX: 'clip' }}>
                {showEditor ? (
                    <DocsEditor
                        onClose={handleCloseEditor}
                        onPublish={handlePublish}
                        initialDoc={editingDoc}
                    />
                ) : selectedUserDoc ? (
                    <UserDocReader
                        doc={selectedUserDoc}
                        dictionary={dictionary}
                    />
                ) : selectedDocId?.startsWith('user-') ? (
                    <UserDocReader
                        doc={{
                            id: selectedDocId,
                            title: selectedDocId.replace('user-', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                            topic: 'developers',
                            html: '',
                            tags: '',
                            publishedAt: 0
                        }}
                        dictionary={dictionary}
                    />
                ) : (
                    <>
                        <div className="no-print">
                            <FeaturedDocsHero
                                dictionary={dictionary}
                                collapsed={selectedDocId !== null}
                                onSelectDoc={handleSelectDoc}
                            />
                        </div>
                        {selectedDocId && (
                            <DocReaderView
                                docId={selectedDocId}
                                onTopicClick={handleTopicToggle}
                                searchQuery={searchQuery}
                                dictionary={dictionary}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
