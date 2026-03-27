'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormattingState } from './types';

const DEFAULT_STATE: FormattingState = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false,
    unorderedList: false,
    orderedList: false,
    fontSize: '3',
    foreColor: '',
    hiliteColor: '',
    blockType: 'p',
};

function safeQuery(cmd: string): boolean {
    if (typeof document === 'undefined') return false;
    try { return document.queryCommandState(cmd); } catch { return false; }
}

function safeValue(cmd: string): string {
    if (typeof document === 'undefined') return '';
    try { return document.queryCommandValue(cmd); } catch { return ''; }
}

/** Polls the document selection to derive active formatting for toolbar highlighting. */
export function useFormattingState(editorRef: React.RefObject<HTMLDivElement | null>) {
    const [state, setState] = useState<FormattingState>(DEFAULT_STATE);
    const rafRef = useRef<number | undefined>(undefined);

    const updateRef = useRef(() => { });
    updateRef.current = () => {
        if (typeof window === 'undefined') return;
        const sel = window.getSelection();
        if (!editorRef.current) return;
        const anchorNode = sel?.anchorNode;
        if (anchorNode && !editorRef.current.contains(anchorNode)) return;

        const raw = safeValue('foreColor');
        const hiRaw = safeValue('hiliteColor') || safeValue('backColor');
        const blockRaw = safeValue('formatBlock').toLowerCase().replace(/^\[|\]$/g, '');

        setState({
            bold: safeQuery('bold'),
            italic: safeQuery('italic'),
            underline: safeQuery('underline'),
            strikethrough: safeQuery('strikeThrough'),
            alignLeft: safeQuery('justifyLeft') || (!safeQuery('justifyCenter') && !safeQuery('justifyRight')),
            alignCenter: safeQuery('justifyCenter'),
            alignRight: safeQuery('justifyRight'),
            unorderedList: safeQuery('insertUnorderedList'),
            orderedList: safeQuery('insertOrderedList'),
            fontSize: safeValue('fontSize') || '3',
            foreColor: raw,
            hiliteColor: hiRaw,
            blockType: blockRaw || 'p',
        });
    };

    const forceUpdate = () => updateRef.current();

    useEffect(() => {
        const scheduleUpdate = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => updateRef.current());
        };

        document.addEventListener('selectionchange', scheduleUpdate);
        return () => {
            document.removeEventListener('selectionchange', scheduleUpdate);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return { state, forceUpdate };
}
