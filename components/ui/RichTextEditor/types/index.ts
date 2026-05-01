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
    hiliteColor: string;     // hex or rgb
    blockType: string;       // 'p' | 'h1' | 'h2' | 'h3' | 'pre' | 'blockquote'
}

export interface EditorToolbarDictionary {
    undo?: string;
    redo?: string;
    paragraph?: string;
    heading1?: string;
    heading2?: string;
    heading3?: string;
    bold?: string;
    italic?: string;
    underline?: string;
    strikethrough?: string;
    code?: string;
    text_color?: string;
    bg_color?: string;
    unordered_list?: string;
    ordered_list?: string;
    align_left?: string;
    align_center?: string;
    align_right?: string;
    blockquote?: string;
    code_block?: string;
    link?: string;
    insert_image?: string;
    horizontal_rule?: string;
    clear_format?: string;
    font_size_small?: string;
    font_size_medium?: string;
    font_size_large?: string;
    [key: string]: string | undefined;
}

export interface EditorToolbarProps {
    formatState: FormattingState;
    onCommand: (command: string, value?: string) => void;
    onBlockType: (type: 'h1' | 'h2' | 'h3' | 'p' | 'blockquote') => void;
    onInsertLink: () => void;
    onInsertCodeBlock: () => void;
    onInsertImage: () => void;
    onFontSize: (size: '1' | '3' | '5') => void;
    onForeColor: (color: string) => void;
    onHiliteColor: (color: string) => void;
    t?: Partial<EditorToolbarDictionary>;
    disallowImages?: boolean;
}

export interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    t?: Partial<EditorToolbarDictionary>;
    toolbarPosition?: 'top' | 'bottom';
    minHeight?: string;
    maxHeight?: string;
    autoFocus?: boolean;
    maxLength?: number;    // Character limit
    disallowImages?: boolean; // Disable image uploads/pasting
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
    t?: Partial<EditorToolbarDictionary>;
}

export interface DiscardDialogProps {
    onConfirm: () => void;
    onClose: () => void;
    t?: Partial<EditorToolbarDictionary>;
}
