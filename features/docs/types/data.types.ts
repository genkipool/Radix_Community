import { ReactNode } from 'react';
import { z } from 'zod';

export const UserDocSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(85, 'Title cannot exceed 85 characters'),
  topic: z.string(),
  html: z.string(),
  tags: z.string(),
  publishedAt: z.number(),
  updatedAt: z.number().optional(),
  author: z.string().optional(),
  showAuthor: z.boolean().optional(),
});

/** A document created and published by a community user through the editor. */
export interface UserDoc {
  id: string;
  title: string;
  topic: string;
  html: string;
  tags: string;
  publishedAt: number;
  updatedAt?: number;
  /** Author display name — only shown when showAuthor is true */
  author?: string;
  showAuthor?: boolean;
}

export interface UserTocEntry {
    id: string;
    text: string;
    level: 2 | 3 | 4;
}

export interface ReaderToCEntry {
    id: string;
    text: string;
    level: number;
}

/** A table-of-contents entry within a documentation document. */
export interface TocEntry {
    /** HTML anchor id on the rendered section */
    id: string;
    /** Key in t.docs.content for the section title */
    titleKey: string;
    /** Key in t.docs.content for the section body */
    bodyKey: string;
    level: 2 | 3 | 4;
}

/** Metadata for a curated documentation document. */
export interface DocData {
    id: string;
    /** Key in t.docs.documents */
    titleKey: string;
    topicId: string;
    /** Key in t.docs.topics */
    topicKey: string;
    toc: TocEntry[];
    /** Optional ISO date string for display (e.g. '2024-01-15') */
    publishedAt?: string;
}

export interface DocItem {
    id: string;
    titleKey: string;
    _userTitle?: string;
}

export interface Topic {
    id: string;
    topicKey: string;
    icon: ReactNode;
    gradient: string;
    docs: DocItem[];
}

export const USER_DOCS_STORAGE_KEY = 'docs_published_community';
