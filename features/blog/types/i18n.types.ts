import { BlogPost } from './data.types';

export interface BlogDictionary {
    title: string;
    subtitle: string;
    all: string;
    tags: Record<string, string>;
    author: string;
    views: string;
    like: string;
    previous?: string;
    next?: string;
    listen: string;
    stop: string;
    controls: {
        search_placeholder: string;
        newest?: string;
        oldest?: string;
        by_date?: string;
        reading_mode?: string;
        expand_all?: string;
        collapse_all?: string;
        auto_collapse?: string;
        ascending?: string;
        descending?: string;
        [key: string]: string | unknown;
    };
    calendar: {
        title: string;
        month: string;
        year: string;
        weekdays: string[];
        reset_button: string;
        apply_button: string;
        start_date: string;
        end_date: string;
        range_placeholder: string;
        [key: string]: string | unknown;
    };
    posts: BlogPost[];
    [key: string]: string | unknown;
}
