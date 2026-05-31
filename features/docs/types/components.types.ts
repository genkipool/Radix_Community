import { ReactNode } from 'react';
import type { UserDoc } from './data.types';
import type { Dictionary } from '@/i18n';
/** Compact sidebar metadata serialised into a cookie by saveUserDocs for SSR. */
export interface UserDocMeta {
    id: string;
    title: string;
    topic: string;
    publishedAt?: number;
    author?: string;
    showAuthor?: boolean;
}

export interface DocsClientProps {
    initialAutoCollapse?: boolean;
    initialExpandedTopics?: string;
    /** Pre-rendered sidebar metadata from the docs_sidebar_meta cookie.
     *  Allows the server to include the correct doc titles in the initial HTML,
     *  so published cards are never missing on reload. */
    initialUserDocMeta?: UserDocMeta[];
    dictionary?: Partial<Dictionary>;
}

export interface DocsSidebarProps {
    selectedDocId: string | null;
    onSelectDoc: (id: string | null) => void;
    expandedTopics: Set<string>;
    onTopicToggle: (id: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    autoCollapse: boolean;
    onAutoCollapseChange: (v: boolean) => void;
    searchQuery: string;
    onSearchQueryChange: (q: string) => void;
    onAdminClick?: () => void;
    isEditorOpen?: boolean;
    userDocs?: UserDoc[];
    onEditUserDoc?: (docId: string) => void;
    onDeleteUserDoc?: (docId: string) => void;
    searchValue?: string;
    className?: string;
}

export interface DocReaderViewProps {
    docId: string;
    onTopicClick: (topicId: string) => void;
    searchQuery?: string;
    dictionary?: Partial<import('@/i18n').Dictionary>;
}

export interface DocsEditorProps {
    onClose: () => void;
    onPublish?: (doc: UserDoc) => void;
    initialDoc?: UserDoc;
}

export interface UserDocReaderProps {
    doc: UserDoc;
    dictionary?: Partial<Dictionary>;
}

export interface FeaturedDocsHeroProps {
    collapsed: boolean;
    onSelectDoc: (id: string) => void;
}

export interface DeleteDocModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    docTitle: string;
}

/* Internal Editor Types */
export interface ToastMsg {
    id: number;
    type: 'success' | 'error' | 'info';
    text: string;
}

export interface DraftData {
    title: string;
    html: string;
    tags: string;
    topic: string;
    savedAt: number;
}

export interface ToggleSwitchProps {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}

export interface ActionButtonProps {
    children: ReactNode;
    title: string;
    onClick?: () => void;
}

export interface DocSectionProps {
    id: string;
    title: string;
    level?: 2 | 3 | 4;
    searchQuery?: string;
}

export interface DocCalloutProps {
    title: string;
    children: ReactNode;
}

export interface TocItemProps {
    entry: import('./data.types').TocEntry;
    label: string;
    isActive: boolean;
}

export interface UserTocItemProps {
    entry: import('./data.types').UserTocEntry;
    isActive: boolean;
}

/* Unified Reader Types */
export interface ReaderBaseLayoutProps {
    children: ReactNode;
    sidebarHeader: ReactNode;
    sidebarContent: ReactNode;
    breadcrumb: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    publishDate?: number | string;
    author?: string;
    showAuthor?: boolean;
}

export interface ReaderTocItemProps {
    entry: import('./data.types').ReaderToCEntry;
    isActive: boolean;
}
