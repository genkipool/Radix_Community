import React from 'react';
import type { DocsEditorDictionary } from './i18n.types';

/* ─── useFormattingState Types ─── */
export interface FormattingState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    alignLeft: boolean;
    alignCenter: boolean;
    alignRight: boolean;
    unorderedList: boolean;
    orderedList: boolean;
    fontSize: string;        // '1'–'7'; '3' = normal
    foreColor: string;       // hex or rgb
    blockType: string;       // 'p' | 'h1' | 'h2' | 'h3' | 'pre' | 'blockquote'
}

/* ─── EditorToolbar Types ─── */
export interface EditorToolbarProps {
    formatState: FormattingState;
    onCommand: (command: string, value?: string) => void;
    onHeading: (level: 'h1' | 'h2' | 'h3' | 'p') => void;
    onInsertLink: () => void;
    onInsertHr: () => void;
    onInsertCodeBlock: () => void;
    onInsertImage: () => void;
    onFontSize: (size: '1' | '3' | '5') => void;
    onForeColor: (color: string) => void;
    onHiliteColor: (color: string) => void;
    t: DocsEditorDictionary;
}

export interface TBtnProps {
    icon: React.ReactNode;
    title: string;
    active?: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    className?: string;
    children?: React.ReactNode;
}

export interface ColorPickerProps {
    colors: string[];
    currentColor?: string;
    onSelect: (color: string) => void;
    onClose: () => void;
}

export interface FontSizeControlProps {
    current: string;
    onSelect: (size: '1' | '3' | '5') => void;
    t: DocsEditorDictionary;
}

/* ─── EditorDialogs Types ─── */
export interface ModalShellProps {
    children: React.ReactNode;
    onBackdropClick: () => void;
}

export type FieldInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export interface LinkDialogProps {
    onInsert: (url: string, label: string) => void;
    onClose: () => void;
    t: DocsEditorDictionary;
}

export interface DiscardDialogProps {
    onConfirm: () => void;
    onClose: () => void;
    t: DocsEditorDictionary;
}
