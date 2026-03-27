'use client';

import React, { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { 
    fileToDataUrl, 
    buildResizableImageHtml, 
    isInCodeBlock,
    isInBlockquote,
    sanitizePasteHtml
} from '../editorUtils';

import type { EditorToolbarDictionary } from '../types/index';

interface UseRichTextLogicProps {
    editorRef: React.RefObject<HTMLDivElement | null>;
    onSync: (html: string) => void;
    forceUpdate: () => void;
    t: EditorToolbarDictionary;
    disallowImages?: boolean;
    maxLength?: number;
    addToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export function useRichTextLogic({
    editorRef,
    onSync,
    forceUpdate,
    t,
    disallowImages = false,
    maxLength,
    addToast
}: UseRichTextLogicProps) {
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const savedSelRef = useRef<Range | null>(null);

    const syncHtml = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            onSync(html);
        }
    };

    const execCmd = (command: string, value?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        requestAnimationFrame(() => {
            syncHtml();
            forceUpdate();
        });
    };

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            savedSelRef.current = sel.getRangeAt(0).cloneRange();
        }
    };

    const restoreSelection = () => {
        const sel = window.getSelection();
        if (sel && savedSelRef.current) {
            sel.removeAllRanges();
            sel.addRange(savedSelRef.current);
        }
    };

    const handleBlockType = (level: 'h1' | 'h2' | 'h3' | 'p' | 'blockquote') => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        const current = (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/^\[|\]$/g, '');
        const target = current === level ? 'p' : level;
        document.execCommand('formatBlock', false, target);
        requestAnimationFrame(() => {
            syncHtml();
            forceUpdate();
        });
    };

    const handleInsertLink = (url: string, label: string) => {
        restoreSelection();
        editorRef.current?.focus();
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
            document.execCommand('createLink', false, url);
        } else {
            document.execCommand('insertHTML', false,
                `<a href="${url}" target="_blank" rel="noopener noreferrer">${label || url}</a>`);
        }
        setShowLinkDialog(false);
        requestAnimationFrame(syncHtml);
    };

    const handleInsertHr = () => execCmd('insertHTML', '<hr /><p><br></p>');

    const handleInsertCodeBlock = () => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        const sel = window.getSelection();
        const inCode = isInCodeBlock(sel, editorRef.current);

        if (inCode) {
            const p = document.createElement('p');
            p.innerHTML = inCode.innerHTML || '<br>';
            inCode.closest('pre')?.replaceWith(p);
        } else {
            document.execCommand('insertHTML', false, '<pre><code class="language-js"></code></pre><p><br></p>');
            requestAnimationFrame(() => {
                const pre = editorRef.current?.querySelector('pre:last-of-type');
                const code = pre?.querySelector('code');
                if (code && editorRef.current) {
                    const r = document.createRange();
                    if (!code.firstChild) code.appendChild(document.createTextNode(''));
                    r.setStart(code.firstChild!, 0);
                    r.collapse(true);
                    sel?.removeAllRanges();
                    sel?.addRange(r);
                }
            });
        }
        requestAnimationFrame(() => {
            syncHtml();
            forceUpdate();
        });
    };

    const insertImageSrc = (src: string, alt = '') => {
        if (disallowImages) return;
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, buildResizableImageHtml(src, alt));
        requestAnimationFrame(syncHtml);
    };

    const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disallowImages) return;
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const src = await fileToDataUrl(file);
            insertImageSrc(src, file.name);
        } catch (err) {
            if (addToast) addToast('error', t.image_error ?? 'Failed to load image.');
            else console.error('Failed to load image', err);
        }
        e.target.value = '';
    };

    const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
        const imgItem = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
        if (imgItem) {
            e.preventDefault();
            if (disallowImages) return;
            const blob = imgItem.getAsFile();
            if (blob) {
                fileToDataUrl(blob).then(src => insertImageSrc(src));
            }
            return;
        }

        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        
        const sel = window.getSelection();
        const code = isInCodeBlock(sel, editorRef.current!);

        // Character limit check
        if (maxLength && editorRef.current) {
            const currentLen = editorRef.current.innerText.length;
            if (currentLen + text.length > maxLength) {
                e.preventDefault();
                const allowedText = text.substring(0, maxLength - currentLen);
                if (allowedText.length > 0) {
                    document.execCommand('insertText', false, allowedText);
                    requestAnimationFrame(syncHtml);
                }
                return;
            }
        }

        // Priority 1: Handle paste inside code blocks (Always plain text, preserve newlines)
        if (code) {
            e.preventDefault();
            const cleanText = text.replace(/\r\n/g, '\n');
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(cleanText);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            requestAnimationFrame(syncHtml);
            return;
        }

        // Priority 2: Handle HTML paste with sanitation (for quotes and normal text)
        if (html) {
            e.preventDefault();
            const cleanHtml = sanitizePasteHtml(html);
            document.execCommand('insertHTML', false, cleanHtml);
            requestAnimationFrame(syncHtml);
            return;
        }

        // Default behavior for plain text handles automatically if not prevented
    };

    const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (disallowImages) return;
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (file) {
            const src = await fileToDataUrl(file);
            insertImageSrc(src, file.name);
        }
    };

    const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('.img-size-btn') as HTMLElement | null;
        
        if (btn) {
            e.preventDefault();
            const { size } = btn.dataset;
            const wrap = btn.closest('.editor-img-wrap');
            const img = wrap?.querySelector('img') as HTMLImageElement | null;
            if (img && size) {
                img.style.maxWidth = `${size}%`;
                wrap?.querySelectorAll('.img-size-btn').forEach(b => {
                    (b as HTMLElement).style.background = 'var(--color-surface)';
                    (b as HTMLElement).style.color = 'var(--color-text-muted)';
                });
                btn.style.background = 'var(--color-primary)';
                btn.style.color = 'var(--color-bg)';
            }
            return;
        }

        // Exit block on click below trailing block
        if (e.target === editorRef.current && editorRef.current) {
            const last = editorRef.current.lastElementChild;
            if (last && (last.nodeName === 'PRE' || last.nodeName === 'BLOCKQUOTE')) {
                const rect = last.getBoundingClientRect();
                if (e.clientY > rect.bottom) {
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    editorRef.current.appendChild(p);
                    const sel = window.getSelection();
                    const r = document.createRange();
                    r.setStart(p, 0);
                    r.collapse(true);
                    sel?.removeAllRanges();
                    sel?.addRange(r);
                    requestAnimationFrame(() => {
                        syncHtml();
                        forceUpdate();
                    });
                }
            }
        }
    };

    const tryMarkdownShortcut = (): boolean => {
        // Real-time markdown parsing is disabled per user request.
        // The markdown transformations now happen on Preview / Publish.
        return false;
    };



    const handleInput = () => {
        syncHtml();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const mod = e.metaKey || e.ctrlKey;

        if (e.key === 'Escape' && editorRef.current) {
            const sel = window.getSelection();
            const block = isInCodeBlock(sel, editorRef.current) || isInBlockquote(sel, editorRef.current);
            if (block) {
                e.preventDefault();
                const container = block.closest('pre, blockquote');
                if (container) {
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    container.insertAdjacentElement('afterend', p);
                    const r = document.createRange();
                    r.setStart(p, 0);
                    r.collapse(true);
                    sel?.removeAllRanges();
                    sel?.addRange(r);
                    requestAnimationFrame(syncHtml);
                    return;
                }
            }
        }

        if (mod && e.key === 'b') { e.preventDefault(); execCmd('bold'); return; }
        if (mod && e.key === 'i') { e.preventDefault(); execCmd('italic'); return; }
        if (mod && e.key === 'u') { e.preventDefault(); execCmd('underline'); return; }
        if (mod && e.key === 'z') { e.preventDefault(); execCmd(e.shiftKey ? 'redo' : 'undo'); return; }

        if (e.key === ' ' && tryMarkdownShortcut()) {
            e.preventDefault();
            return;
        }

        if (e.key === '`' && editorRef.current) {
            const sel = window.getSelection();
            if (sel?.rangeCount && sel.getRangeAt(0).startContainer.nodeType === Node.TEXT_NODE) {
                const textNode = sel.getRangeAt(0).startContainer;
                const offset = sel.getRangeAt(0).startOffset;
                const text = textNode.textContent ?? '';
                if (text.slice(0, offset).endsWith('`')) {
                    const content = text.slice(text.lastIndexOf('`', offset-2) + 1, offset - 1);
                    if (content) {
                        e.preventDefault();
                        const r = document.createRange();
                        r.setStart(textNode, offset - content.length - 2);
                        r.setEnd(textNode, offset);
                        sel.removeAllRanges();
                        sel.addRange(r);
                        document.execCommand('insertHTML', false, `<code>${content}</code>&nbsp;`);
                        requestAnimationFrame(syncHtml);
                        return;
                    }
                }
            }
        }

        // Character limit check
        if (maxLength && editorRef.current) {
            const isControlKey = e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || mod;
            if (!isControlKey && editorRef.current.innerText.length >= maxLength) {
                const selection = window.getSelection();
                if (selection && selection.isCollapsed) {
                    e.preventDefault();
                    return;
                }
            }
        }

        if (e.key === 'Enter' && editorRef.current) {
            const sel = window.getSelection();
            const code = isInCodeBlock(sel, editorRef.current);
            const quote = isInBlockquote(sel, editorRef.current);
            const activeBlock = code || quote;

            if (activeBlock) {
                if (e.shiftKey || (mod && e.key === 'Enter')) {
                    // Exit block on Shift+Enter or Ctrl+Enter
                    e.preventDefault();
                    const container = activeBlock.closest('pre, blockquote');
                    if (container) {
                        const p = document.createElement('p');
                        p.innerHTML = '<br>';
                        container.insertAdjacentElement('afterend', p);
                        const r = document.createRange();
                        r.setStart(p, 0);
                        r.collapse(true);
                        sel?.removeAllRanges();
                        sel?.addRange(r);
                        requestAnimationFrame(syncHtml);
                        return;
                    }
                } else if (!e.shiftKey && !mod) {
                    if (code) {
                        e.preventDefault();
                        document.execCommand('insertText', false, '\n');
                        requestAnimationFrame(syncHtml);
                        return;
                    }
                    // Let the browser handle standard Enter in blockquotes for better native flow
                }
            }
        }

        if (e.key === 'Enter' && tryMarkdownShortcut()) {
            e.preventDefault();
            return;
        }

        requestAnimationFrame(() => {
            if (e.key === 'Enter') {
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    let block = (sel.getRangeAt(0).startContainer.nodeType === Node.ELEMENT_NODE ? sel.getRangeAt(0).startContainer as Element : sel.getRangeAt(0).startContainer.parentElement)?.closest('h1,h2,h3,h4,h5,h6,p,li') as HTMLElement | null;
                    
                    if (block) {
                        const isEmpty = block.textContent?.replace(/\u200B/g, '').trim() === '';
                        if (/^h[1-6]$/i.test(block.nodeName) && isEmpty) {
                            document.execCommand('formatBlock', false, 'p');
                            const updatedSel = window.getSelection();
                            if (updatedSel && updatedSel.rangeCount) {
                                block = (updatedSel.getRangeAt(0).startContainer.nodeType === Node.ELEMENT_NODE ? updatedSel.getRangeAt(0).startContainer as Element : updatedSel.getRangeAt(0).startContainer.parentElement)?.closest('p') as HTMLElement | null;
                            }
                        }
                        
                        if (block && block.textContent?.replace(/\u200B/g, '').trim() === '') {
                            // Safely clear inherited formatting using native toggles
                            document.execCommand('removeFormat');
                            if (document.queryCommandState('bold')) document.execCommand('bold');
                            if (document.queryCommandState('italic')) document.execCommand('italic');
                            if (document.queryCommandState('underline')) document.execCommand('underline');
                            if (document.queryCommandState('strikethrough')) document.execCommand('strikethrough');
                        }
                    }
                }
            }
            syncHtml();
            forceUpdate();
        });
    };

    return {
        showLinkDialog,
        setShowLinkDialog,
        execCmd,
        syncHtml,
        saveSelection,
        restoreSelection,
        handleBlockType,
        handleInsertLink,
        handleInsertHr,
        handleInsertCodeBlock,
        insertImageSrc,
        handleImageFileChange,
        handlePaste,
        handleDrop,
        handleEditorClick,
        handleInput,
        handleKeyDown
    };
}
