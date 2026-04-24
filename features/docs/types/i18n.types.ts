export interface DocsEditorDictionary {
    title_placeholder?: string;
    content_placeholder?: string;
    topic_label?: string;
    close?: string;
    draft_saved?: string;
    draft_recovery_title?: string;
    draft_last_saved?: string;
    draft_restore?: string;
    draft_discard_btn?: string;
    empty_title_error?: string;
    empty_content_error?: string;
    image_error?: string;
    drop_image?: string;
    share?: string;
    print?: string;
    callout_epochs?: string;
    tags_label?: string;
    tags_placeholder?: string;
    show_author_label?: string;
    author_name_placeholder?: string;
    word_count?: string;
    char_count?: string;
    import_md_title?: string;
    save_draft?: string;
    update_btn?: string;
    publish_btn?: string;
    // Missing keys
    insert_link?: string;
    link_label_placeholder?: string;
    insert?: string;
    cancel?: string;
    confirm_discard?: string;
    confirm_discard_desc?: string;
    discard?: string;
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

export interface DocsDictionary {
    community_docs?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    heroDescription?: string;
    cta_connect_wallet?: string;
    cta_buy_badge?: string;
    searchPlaceholder?: string;
    featured?: string;
    readArticle?: string;
    filters?: {
        all?: string;
        whitepapers?: string;
        developer?: string;
        guides?: string;
        resources?: string;
    };
    edit?: string;
    delete?: string;
    noResults?: string;
    sidebar?: {
        collapse_all?: string;
        expand_all?: string;
        docs_home_aria?: string;
    };
    svg?: {
        appName?: string;
        docsTitle?: string;
        docsSubtitle?: string;
        ledger?: string;
    };
    topics?: Record<string, string>;
    documents?: Record<string, string>;
    content?: Record<string, string>;
    modal?: {
        subtitle?: string;
    };
    actions?: {
        download_md?: string;
        share?: string;
        print?: string;
        copied?: string;
    };
    share?: string;
    print?: string;
    post?: {
        no_posts?: string;
        replies?: string;
        date?: string;
        like?: string;
        dislike?: string;
        reply?: string;
        in_reply_to?: string;
    };
    editor?: DocsEditorDictionary;
    featured_cards?: Record<string, { title?: string; desc?: string }>;
    tags?: Record<string, string>;
    delete_modal?: {
        title?: string;
        description?: string;
        keyword?: string;
        keyword_message?: string;
        to_confirm?: string;
        input_placeholder?: string;
        confirm?: string;
    };
}

export interface Dictionary {
    common?: {
        cancel?: string;
        save?: string;
        delete?: string;
    };
    docs?: DocsDictionary;
    [key: string]: unknown;
}
