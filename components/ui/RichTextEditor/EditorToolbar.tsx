'use client';

import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Bold, Italic,
    Undo2, Redo2, RemoveFormatting,
    Type, Heading1, Heading2, Heading3,
    Quote,
    Code2, Link2, ImageIcon,
    Eye
} from 'lucide-react';
import type {
    EditorToolbarProps,
    EditorToolbarDictionary
} from './types/index';
import { TEXT_COLORS, BG_COLORS, FONT_SIZES } from './constants';

/* ─── Separator ─── */
function Sep() {
    return (
        <div
            className="w-px h-5 shrink-0 mx-0.5 self-center"
            style={{ background: 'var(--color-card-border)' }}
        />
    );
}

/* ─── Toolbar button ─── */
const TBtn = React.forwardRef<
    HTMLButtonElement,
    {
        icon: React.ReactNode;
        title: string;
        active?: boolean;
        onMouseDown: (e: React.MouseEvent) => void;
        children?: React.ReactNode;
    }
>(({
    icon,
    title,
    active = false,
    onMouseDown,
    children
}, ref) => {
    return (
        <button
            type="button"
            ref={ref}
            onMouseDown={onMouseDown}
            title={title}
            aria-pressed={active}
            className="relative flex items-center justify-center rounded-md transition-all duration-100 shrink-0 select-none group"
            style={{
                minWidth: '2rem',
                height: '2rem',
                padding: '0 0.25rem',
                background: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'var(--color-bg)' : 'var(--color-text-muted)',
                border: active ? '1px solid var(--color-primary)' : '1px solid transparent',
            }}
            onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                if (!active) {
                    el.style.background = 'var(--color-surface)';
                    el.style.color = 'var(--color-text-main)';
                }
            }}
            onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                if (!active) {
                    el.style.background = 'transparent';
                    el.style.color = 'var(--color-text-muted)';
                }
            }}
        >
            {icon}
            {children}
        </button>
    );
});
TBtn.displayName = 'TBtn';

/* ─── Color picker popup ─── */
function ColorPicker({
    colors,
    currentColor,
    onSelect,
    onClose,
    anchorEl
}: {
    colors: string[];
    currentColor?: string;
    onSelect: (color: string) => void;
    onClose: () => void;
    anchorEl: HTMLElement | null;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0, position: 'absolute', top: 0, left: 0 });

    useLayoutEffect(() => {
        const updatePosition = () => {
            if (anchorEl && ref.current) {
                const anchorRect = anchorEl.getBoundingClientRect();
                const pickerRect = ref.current.getBoundingClientRect();
                
                const scrollX = window.scrollX || window.pageXOffset;
                const scrollY = window.scrollY || window.pageYOffset;

                let left = anchorRect.left + scrollX + (anchorRect.width / 2) - (pickerRect.width / 2);
                const top = anchorRect.bottom + scrollY + 4;

                const viewportWidth = window.innerWidth;
                if (left + pickerRect.width > viewportWidth + scrollX - 8) {
                    left = viewportWidth + scrollX - pickerRect.width - 8;
                }
                if (left < scrollX + 8) {
                    left = scrollX + 8;
                }

                setStyle({
                    position: 'absolute',
                    top: `${top}px`,
                    left: `${left}px`,
                    zIndex: 9999,
                    opacity: 1
                });
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true); // Capture scroll too

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [anchorEl]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return createPortal(
        <div
            ref={ref}
            className="p-2 rounded-xl shadow-2xl grid grid-cols-4 gap-1"
            style={{
                ...style,
                background: 'var(--color-card-bg)',
                border: '1px solid var(--color-card-border)',
                minWidth: '9rem',
            }}
        >
            {colors.map(color => (
                <button
                    type="button"
                    key={color}
                    onMouseDown={e => { e.preventDefault(); onSelect(color); onClose(); }}
                    className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110"
                    style={{
                        background: color,
                        borderColor: currentColor === color ? 'var(--color-primary)' : 'transparent',
                    }}
                    title={color}
                />
            ))}
        </div>,
        document.body
    );
}

/* ─── Font size segmented control ─── */
function FontSizeControl({
    current,
    onSelect,
    t
}: {
    current: string;
    onSelect: (size: '1' | '3' | '5') => void;
    t: EditorToolbarDictionary;
}) {
    const effectiveSize = (['1', '3', '5'].includes(current) ? current : '3') as '1' | '3' | '5';

    return (
        <div
            className="flex items-center rounded-md overflow-hidden shrink-0"
            style={{ border: '1px solid var(--color-card-border)' }}
        >
            {FONT_SIZES.map(({ value, label, title }) => {
                const isActive = effectiveSize === value;
                return (
                    <button
                        type="button"
                        key={value}
                        onMouseDown={e => { e.preventDefault(); onSelect(value); }}
                        title={t[`font_size_${value === '1' ? 'small' : value === '3' ? 'medium' : 'large'}`] ?? title}
                        className="flex items-center justify-center text-xs font-bold transition-all duration-100"
                        style={{
                            width: '1.75rem',
                            height: '2rem',
                            background: isActive ? 'var(--color-primary)' : 'transparent',
                            color: isActive ? 'var(--color-bg)' : 'var(--color-text-muted)',
                            fontSize: value === '1' ? '0.65rem' : value === '3' ? '0.75rem' : '0.9rem',
                            borderRight: value !== '5' ? '1px solid var(--color-card-border)' : 'none',
                        }}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

export default function EditorToolbar({
    formatState: fs,
    onCommand,
    onBlockType,
    onInsertLink,
    onInsertCodeBlock,
    onInsertImage,
    onFontSize,
    onForeColor,
    onHiliteColor,
    t,
    disallowImages = false,
    previewMode = false,
    onTogglePreview
}: EditorToolbarProps & { previewMode?: boolean; onTogglePreview?: () => void }) {
    const [showForeColors, setShowForeColors] = useState(false);
    const [showHiliteColors, setShowHiliteColors] = useState(false);
    const foreBtnRef = useRef<HTMLButtonElement>(null);
    const hiliteBtnRef = useRef<HTMLButtonElement>(null);

    const cmd = (command: string, value?: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        onCommand(command, value);
    };

    const blockActive = (type: string) => fs.blockType === type;

    return (
        <div
            className="flex items-center gap-1 rounded-xl border shadow-sm px-2 py-1.5 overflow-x-auto custom-scrollbar no-scrollbar-on-mobile flex-nowrap"
            style={{
                borderColor: 'var(--color-card-border)',
                background: 'var(--color-bg-card)',
            }}
        >
            <div className="flex items-center gap-0.5 shrink-0">
                <TBtn icon={<Undo2 className="w-5 h-5" />} title={t.undo ?? 'Undo'} onMouseDown={cmd('undo')} />
                <TBtn icon={<Redo2 className="w-5 h-5" />} title={t.redo ?? 'Redo'} onMouseDown={cmd('redo')} />
            </div>
            <Sep />

            <div className="flex items-center gap-0.5 shrink-0">
                <TBtn
                    icon={<Type className="w-5 h-5" />}
                    title={t.paragraph ?? 'Paragraph'}
                    active={blockActive('p') || blockActive('')}
                    onMouseDown={e => { e.preventDefault(); onBlockType('p'); }}
                />
                <TBtn
                    icon={<Heading1 className="w-5 h-5" />}
                    title={t.heading1 ?? 'Heading 1'}
                    active={blockActive('h1')}
                    onMouseDown={e => { e.preventDefault(); onBlockType('h1'); }}
                />
                <TBtn
                    icon={<Heading2 className="w-5 h-5" />}
                    title={t.heading2 ?? 'Heading 2'}
                    active={blockActive('h2')}
                    onMouseDown={e => { e.preventDefault(); onBlockType('h2'); }}
                />
                <TBtn
                    icon={<Heading3 className="w-5 h-5" />}
                    title={t.heading3 ?? 'Heading 3'}
                    active={blockActive('h3')}
                    onMouseDown={e => { e.preventDefault(); onBlockType('h3'); }}
                />
            </div>
            <Sep />

            <div className="shrink-0 flex items-center">
                <FontSizeControl current={fs.fontSize} onSelect={onFontSize} t={t} />
            </div>
            <Sep />

            <div className="flex items-center gap-0.5 shrink-0">
                <TBtn icon={<Bold className="w-4 h-4" />} title={t.bold ?? 'Bold (Ctrl+B)'} active={fs.bold} onMouseDown={cmd('bold')} />
                <TBtn icon={<Italic className="w-4 h-4" />} title={t.italic ?? 'Italic (Ctrl+I)'} active={fs.italic} onMouseDown={cmd('italic')} />
                <TBtn
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"></path></svg>}
                    title={t.underline ?? 'Underline (Ctrl+U)'}
                    active={fs.underline}
                    onMouseDown={cmd('underline')}
                />
                <TBtn
                    icon={(
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 5V4H6v1m6-1v16m-2 0h4M4 12h16"></path>
                        </svg>
                    )}
                    title={t.strikethrough ?? 'Strikethrough'}
                    active={fs.strikethrough}
                    onMouseDown={cmd('strikeThrough')}
                />
            </div>
            <Sep />

            <div className="flex items-center gap-0.5 shrink-0">
                {/* Text color */}
                <div className="relative">
                    <TBtn
                        ref={foreBtnRef}
                        icon={
                            <span className="flex flex-col items-center gap-0.5">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                    <path d="M11 3L5.5 17h2.25l1.12-3h6.25l1.12 3h2.25L13 3h-2zm-1.38 9L12 5.67 14.38 12H9.62z" />
                                    <rect x="0" y="20" width="24" height="4" fill={fs.foreColor || 'var(--color-primary)'} className="itg-color-indicator" />
                                </svg>
                            </span>
                        }
                        title={t.text_color ?? 'Text color'}
                        onMouseDown={e => { 
                            e.preventDefault(); 
                            setShowForeColors(v => !v); 
                            setShowHiliteColors(false); 
                        }}
                    />
                    {showForeColors && (
                        <ColorPicker 
                            colors={TEXT_COLORS} 
                            currentColor={fs.foreColor} 
                            onSelect={onForeColor} 
                            onClose={() => setShowForeColors(false)} 
                            anchorEl={foreBtnRef.current}
                        />
                    )}
                </div>

                {/* Highlight color */}
                <div className="relative">
                    <TBtn
                        ref={hiliteBtnRef}
                        icon={
                            <span className="flex flex-col items-center gap-0.5">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                    <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z" />
                                    <rect x="0" y="20" width="24" height="4" fill={fs.hiliteColor || '#ffff00'} className="itg-color-indicator" />
                                </svg>
                            </span>
                        }
                        title={t.bg_color ?? 'Highlight color'}
                        onMouseDown={e => { 
                            e.preventDefault(); 
                            setShowHiliteColors(v => !v); 
                            setShowForeColors(false); 
                        }}
                    />
                    {showHiliteColors && (
                        <ColorPicker 
                            colors={BG_COLORS} 
                            onSelect={onHiliteColor} 
                            onClose={() => setShowHiliteColors(false)} 
                            anchorEl={hiliteBtnRef.current}
                        />
                    )}
                </div>
            </div>
            <Sep />

            <div className="flex items-center gap-0.5 shrink-0">
                <TBtn
                    icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 10h13M3 14h18M3 18h13M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                    title={t.align_left ?? 'Align left'}
                    active={fs.alignLeft}
                    onMouseDown={cmd('justifyLeft')}
                />
                <TBtn
                    icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 14h18m-4-4H7m10 8H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                    title={t.align_center ?? 'Center'}
                    active={fs.alignCenter}
                    onMouseDown={cmd('justifyCenter')}
                />
                <TBtn
                    icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" transform="scale(-1 1)"><path d="M3 10h13M3 14h18M3 18h13M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                    title={t.align_right ?? 'Align right'}
                    active={fs.alignRight}
                    onMouseDown={cmd('justifyRight')}
                />
            </div>
            <Sep />

            <div className="flex items-center gap-0.5 shrink-0">
                <TBtn
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m8 6 13 .001m-13 6h13m-13 6h13M3.5 6h.01m-.01 6h.01m-.01 6h.01M4 6a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m0 6a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m0 6a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                    title={t.unordered_list ?? 'Bullet list'}
                    active={fs.unorderedList}
                    onMouseDown={cmd('insertUnorderedList')}
                />
                <TBtn
                    icon={<svg width="18" height="18" viewBox="0 0 56 56" fill="currentColor"><path d="M9.496 19.012c.914 0 1.524-.516 1.524-1.57v-7.57c0-.985-.704-1.618-1.711-1.618-.844 0-1.36.281-1.946.68l-1.64 1.148c-.493.328-.75.633-.75 1.125 0 .61.492 1.031 1.03 1.031.282 0 .446-.047.845-.328l1.078-.726h.023v6.257c0 1.055.633 1.57 1.547 1.57m8.133-2.836h32.086c1.078 0 1.898-.82 1.898-1.875 0-1.078-.82-1.899-1.898-1.899H17.629c-1.055 0-1.875.82-1.875 1.899 0 1.054.82 1.875 1.875 1.875M5.723 33.145h6.023c.656 0 1.125-.446 1.125-1.102 0-.703-.469-1.148-1.125-1.148H8.395v-.07l1.921-1.548c1.617-1.312 2.227-2.062 2.227-3.445 0-1.875-1.57-3.14-4.102-3.14-2.226 0-3.867 1.171-3.867 2.671 0 .75.492 1.149 1.29 1.149.538 0 .913-.164 1.218-.703.328-.563.773-.868 1.406-.868.703 0 1.172.446 1.172 1.102 0 .563-.281 1.055-1.476 2.016l-3.094 2.53c-.445.376-.633.798-.633 1.313 0 .727.492 1.242 1.266 1.242m11.906-2.79h32.086a1.876 1.876 0 0 0 1.898-1.898c0-1.055-.82-1.875-1.898-1.875H17.629c-1.055 0-1.875.82-1.875 1.875s.82 1.898 1.875 1.898M8.512 47.747c2.765 0 4.43-1.242 4.43-3.21 0-1.29-.915-2.18-2.532-2.321v-.07c1.195-.211 2.11-1.008 2.11-2.368 0-1.78-1.735-2.765-4.032-2.765-1.851 0-3.843.867-3.843 2.414 0 .656.468 1.125 1.195 1.125.515 0 .75-.211 1.078-.563.539-.586.984-.773 1.547-.773.726 0 1.265.351 1.265 1.054 0 .657-.539.985-1.5.985h-.28c-.657 0-1.079.328-1.079 1.008 0 .633.398 1.008 1.078 1.008h.305c1.055 0 1.617.351 1.617 1.078 0 .633-.586 1.101-1.36 1.101-.843 0-1.429-.468-1.874-.914-.282-.258-.516-.445-.938-.445-.773 0-1.312.445-1.312 1.172 0 1.617 2.203 2.484 4.125 2.484m9.117-3.234h32.086c1.078 0 1.898-.82 1.898-1.875 0-1.078-.82-1.899-1.898-1.899H17.629c-1.055 0-1.875.82-1.875 1.899 0 1.054.82 1.875 1.875 1.875"></path></svg>}
                    title={t.ordered_list ?? 'Numbered list'}
                    active={fs.orderedList}
                    onMouseDown={cmd('insertOrderedList')}
                />
            </div>
            <Sep />

            <div className="flex items-center gap-0.5 shrink-0">
                <TBtn icon={<Quote className="w-4 h-4" />} title={t.blockquote ?? 'Blockquote'} active={blockActive('blockquote')} onMouseDown={e => { e.preventDefault(); onBlockType('blockquote'); }} />
                <TBtn icon={<Code2 className="w-4 h-4" />} title={t.code_block ?? 'Code block'} onMouseDown={e => { e.preventDefault(); onInsertCodeBlock(); }} />
                <TBtn icon={<Link2 className="w-4 h-4" />} title={t.link ?? 'Insert link'} onMouseDown={e => { e.preventDefault(); onInsertLink(); }} />
                {!disallowImages && (
                    <TBtn icon={<ImageIcon className="w-4 h-4" />} title={t.insert_image ?? 'Insert image'} onMouseDown={e => { e.preventDefault(); onInsertImage(); }} />
                )}
            </div>
            <Sep />

            <div className="shrink-0 flex items-center gap-0.5">
                <TBtn icon={<RemoveFormatting className="w-4 h-4" />} title={t.clear_format ?? 'Clear formatting'} onMouseDown={cmd('removeFormat')} />
                {onTogglePreview && (
                    <TBtn 
                        icon={<Eye className="w-4 h-4" />} 
                        title="Preview Markdown" 
                        active={previewMode} 
                        onMouseDown={e => { e.preventDefault(); onTogglePreview(); }} 
                    />
                )}
            </div>
        </div>
    );
}
