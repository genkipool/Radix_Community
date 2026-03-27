'use client';

import React, { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { RichTextEditorProps } from './types/index';
import EditorToolbar from './EditorToolbar';
import { useFormattingState } from './useFormattingState';
import { LinkDialog } from './EditorDialogs';
import { useRichTextLogic } from './hooks/useRichTextLogic';
import { 
} from './editorUtils';
import { applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';

/* ─── Styles ─── */
import './RichTextEditor.css';

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'Start writing…',
    className = '',
    t,
    toolbarPosition = 'top',
    minHeight = '200px',
    maxHeight,
    autoFocus = false,
    maxLength,
    disallowImages = false
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const { state: formatState, forceUpdate } = useFormattingState(editorRef);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        showLinkDialog,
        setShowLinkDialog,
        execCmd,
        saveSelection,
        handleBlockType,
        handleInsertLink,
        handleInsertCodeBlock,
        handleImageFileChange,
        handlePaste,
        handleDrop,
        handleEditorClick,
        handleInput,
        handleKeyDown
    } = useRichTextLogic({
        editorRef,
        onSync: onChange,
        forceUpdate,
        t,
        disallowImages,
        maxLength
    });

    // Initial value sync and focus
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '<p><br></p>';
        }
        if (autoFocus && editorRef.current) {
            editorRef.current.focus();
        }
    }, [autoFocus, value]); // Sync initial or change

    const toolbar = (
        <EditorToolbar
            formatState={formatState}
            onCommand={execCmd}
            onBlockType={handleBlockType}
            onInsertLink={() => { saveSelection(); setShowLinkDialog(true); }}
            onInsertCodeBlock={handleInsertCodeBlock}
            onInsertImage={() => fileInputRef.current?.click()}
            onFontSize={size => execCmd('fontSize', size)}
            onForeColor={c => { execCmd('foreColor', c); }}
            onHiliteColor={c => { execCmd('hiliteColor', c); }}
            t={t}
            disallowImages={disallowImages}
            previewMode={previewMode}
            onTogglePreview={() => setPreviewMode(!previewMode)}
        />
    );
    return (
        <div className={`rich-text-editor flex flex-col gap-3 ${className}`}>
            {!disallowImages && (
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
            )}

            <AnimatePresence>
                {showLinkDialog && (
                    <LinkDialog onInsert={handleInsertLink} onClose={() => setShowLinkDialog(false)} t={t} />
                )}
            </AnimatePresence>
            
            {toolbarPosition === 'top' && toolbar}

            <div className={`relative flex-1 border rounded-2xl overflow-hidden bg-[var(--color-bg)]/50`}
                 style={{ borderColor: 'var(--color-card-border)' }}>
                <AnimatePresence>
                    {(isDragOver && !disallowImages) && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 pointer-events-none m-2 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', border: '2px dashed var(--color-primary)' }}>
                            <p className="text-sm font-semibold text-[var(--color-primary)]">Drop image here</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {previewMode && (
                    <div 
                        className="rich-text-content w-full px-6 py-4 custom-scrollbar overflow-y-auto prose prose-invert max-w-none"
                        style={{ 
                            minHeight, 
                            maxHeight,
                            color: 'var(--color-text-main)', 
                            lineHeight: '1.6', 
                            fontSize: '0.95rem'
                        }}
                        dangerouslySetInnerHTML={{ __html: applyMarkdownToHtml(editorRef.current?.innerHTML || '') }}
                    />
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={handleEditorClick}
                    data-placeholder={placeholder}
                    className={`rich-text-content w-full px-6 py-4 focus:outline-none transition-all custom-scrollbar overflow-y-auto ${previewMode ? 'hidden' : ''}`}
                    style={{ 
                        minHeight, 
                        maxHeight,
                        color: 'var(--color-text-main)', 
                        lineHeight: '1.6', 
                        fontSize: '0.95rem', 
                        caretColor: 'var(--color-primary)' 
                    }}
                />
            </div>

            {toolbarPosition === 'bottom' && toolbar}
        </div>
    );
}
