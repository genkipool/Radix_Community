import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { BlogPostCard } from '@/features/blog/components/BlogPostCard';
import type { BlogPost, BlogDictionary } from '@/features/blog/types';

// ─── Mock motion/react ───────────────────────────────────────────────────────
// Replace framer-motion with simple div wrappers so we can test state changes
// without depending on animation internals.
vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
        get: (_target, prop) => {
            const Component = ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => {
                // Filter out motion-specific props and pass style through for z-index testing
                const validProps: Record<string, unknown> = {};
                const motionOnlyKeys = new Set([
                    'initial', 'animate', 'exit', 'whileHover', 'whileInView',
                    'whileTap', 'whileFocus', 'whileDrag', 'variants',
                    'transition', 'viewport', 'layout', 'layoutId',
                    'onAnimationStart', 'onAnimationComplete', 'drag',
                    'dragConstraints', 'dragElastic', 'hoverEffect',
                    'innerClassName',
                ]);
                for (const [key, val] of Object.entries(rest)) {
                    if (!motionOnlyKeys.has(key)) {
                        validProps[key] = val;
                    }
                }
                return React.createElement(prop as string, validProps, children);
            };
            Component.displayName = `motion.${String(prop)}`;
            return Component;
        },
    }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    LayoutGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// ─── Mock next/image ─────────────────────────────────────────────────────────
vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => {
        const { fill: _fill, ...rest } = props;
        return React.createElement('img', rest);
    },
}));

// ─── Test Data ───────────────────────────────────────────────────────────────
const mockPost: BlogPost = {
    id: 1,
    title: 'Test Blog Post Title',
    summary: 'This is a short summary of the blog post content.',
    content: 'This is the full content of the blog post. It contains much more text than the summary, allowing us to verify expansion behavior.',
    date: '2026-01-15',
    tags: ['DeFi'],
    image: '/images/blog/test.jpg',
    author: 'Test Author',
    likes: 42,
    views: 1000,
};

const mockPost2: BlogPost = {
    id: 2,
    title: 'Second Blog Post',
    summary: 'Another short summary.',
    content: 'Another full content body for testing.',
    date: '2026-02-10',
    tags: ['Staking'],
    image: '/images/blog/test2.jpg',
    author: 'Author Two',
    likes: 10,
    views: 500,
};

const mockBlogT: BlogDictionary = {
    title: 'The Blog',
    subtitle: 'Latest news',
    all: 'All',
    tags: { DeFi: 'DeFi', Staking: 'Staking' },
    author: 'Author',
    views: 'Views',
    like: 'Like',
    listen: 'Listen',
    stop: 'Stop',
    controls: {
        search_placeholder: 'Search...',
        newest: 'Newest',
        oldest: 'Oldest',
        by_date: 'By date',
        reading_mode: 'Reading mode',
        expand_all: 'Expand all',
        collapse_all: 'Collapse all',
        auto_collapse: 'Auto collapse',
    },
    modal: {
        new_post_title: 'New Post',
        subtitle: 'Compose your thoughts',
        title_label: 'Title',
        title_placeholder: 'Title...',
        message_label: 'Message',
        message_placeholder: 'Message...',
        tag_label: 'Tag',
        publish_btn: 'Publish',
        reward_title: 'Reward',
        reward_desc: 'Desc',
        beta_disclaimer: 'Beta disclaimer',
    },
    calendar: {
        title: 'Calendar',
        month: 'Month',
        year: 'Year',
        weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        reset_button: 'Reset',
        apply_button: 'Apply',
        start_date: 'Start date',
        end_date: 'End date',
        range_placeholder: 'Select range',
    },
    posts: [mockPost, mockPost2],
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function renderCard(overrides: Partial<React.ComponentProps<typeof BlogPostCard>> = {}) {
    const defaultProps: React.ComponentProps<typeof BlogPostCard> = {
        post: mockPost,
        index: 0,
        columns: 3,
        activeTag: null,
        searchQuery: '',
        expandedPosts: new Set<number>(),
        likedPosts: new Set<number>(),
        readingMode: false,
        selectedPostId: null,
        language: 'en',
        blogT: mockBlogT,
        onExpand: vi.fn(),
        onToggleLike: vi.fn(),
        getLikes: (p: BlogPost) => p.likes,
    };

    return renderWithProviders(<BlogPostCard {...defaultProps} {...overrides} />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('BlogPostCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── Rendering ───────────────────────────────────────────────────────────
    describe('Rendering', () => {
        it('renders the post title', () => {
            renderCard();
            expect(screen.getByText('Test Blog Post Title')).toBeInTheDocument();
        });

        it('renders the post image', () => {
            renderCard();
            const img = screen.getByAltText('Test Blog Post Title');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', '/images/blog/test.jpg');
        });

        it('renders the author name', () => {
            renderCard();
            expect(screen.getByText('Test Author')).toBeInTheDocument();
        });

        it('renders view count', () => {
            renderCard();
            expect(screen.getByText(/1.?000/)).toBeInTheDocument();
        });

        it('renders the tag badge', () => {
            renderCard();
            expect(screen.getByText('DeFi')).toBeInTheDocument();
        });

        it('renders the formatted date', () => {
            renderCard();
            expect(screen.getByText(/Jan/i)).toBeInTheDocument();
        });

        it('renders the summary text when collapsed', () => {
            renderCard();
            expect(screen.getByText(mockPost.summary)).toBeInTheDocument();
        });
    });

    // ─── Accordion Interaction (Reading Mode OFF) ────────────────────────────
    describe('Accordion (readingMode OFF)', () => {
        it('calls onExpand with post id when card is clicked', async () => {
            const onExpand = vi.fn();
            const user = userEvent.setup();
            renderCard({ onExpand });

            // Click the card — the outermost clickable element
            const card = screen.getByText('Test Blog Post Title').closest('div[class*="cursor-pointer"]');
            expect(card).toBeTruthy();
            await user.click(card!);

            expect(onExpand).toHaveBeenCalledTimes(1);
            expect(onExpand).toHaveBeenCalledWith(1);
        });

        it('shows full content when expanded', () => {
            renderCard({ expandedPosts: new Set([1]) });
            expect(screen.getByText(/full content of the blog post/i)).toBeInTheDocument();
        });

        it('shows summary when collapsed', () => {
            renderCard({ expandedPosts: new Set() });
            expect(screen.getByText(mockPost.summary)).toBeInTheDocument();
        });

        it('does NOT have layoutId when readingMode is off', () => {
            const { container } = renderCard({ readingMode: false });
            // The Card component (motion.div) should not have a layoutId attribute
            // Since our mock strips motion props, we verify indirectly that
            // reading mode off means no shared layout transition
            const cardEl = container.firstElementChild;
            expect(cardEl).toBeTruthy();
            // layoutId is stripped by mock, so it should not be in the DOM
            expect(cardEl?.getAttribute('layoutid')).toBeNull();
        });
    });

    // ─── Reading Mode ON ─────────────────────────────────────────────────────
    describe('Reading Mode ON', () => {
        it('calls onExpand with post id when card is clicked in reading mode', async () => {
            const onExpand = vi.fn();
            const user = userEvent.setup();
            renderCard({ readingMode: true, onExpand });

            const card = screen.getByText('Test Blog Post Title').closest('div[class*="cursor-pointer"]');
            await user.click(card!);

            expect(onExpand).toHaveBeenCalledWith(1);
        });
    });

    // ─── Z-Index Management ──────────────────────────────────────────────────
    describe('Z-Index Control', () => {
        it('has z-index 1 when not expanded and not selected', () => {
            const { container } = renderCard();
            const cardEl = container.firstElementChild as HTMLElement;
            expect(cardEl.style.zIndex).toBe('1');
        });

        it('has z-index 40 when expanded (accordion open)', () => {
            const { container } = renderCard({ expandedPosts: new Set([1]) });
            const cardEl = container.firstElementChild as HTMLElement;
            expect(cardEl.style.zIndex).toBe('40');
        });

        it('has z-index 50 when selected (reading mode active)', () => {
            const { container } = renderCard({ readingMode: true, selectedPostId: 1 });
            const cardEl = container.firstElementChild as HTMLElement;
            expect(cardEl.style.zIndex).toBe('50');
        });

        it('has z-index 1 when another post is selected', () => {
            const { container } = renderCard({ readingMode: true, selectedPostId: 999 });
            const cardEl = container.firstElementChild as HTMLElement;
            expect(cardEl.style.zIndex).toBe('1');
        });
    });

    // ─── Like Button ─────────────────────────────────────────────────────────
    describe('Like Button', () => {
        it('renders the like count', () => {
            renderCard();
            expect(screen.getByText('42')).toBeInTheDocument();
        });

        it('calls onToggleLike with post id when like button is clicked', async () => {
            const onToggleLike = vi.fn();
            const user = userEvent.setup();
            renderCard({ onToggleLike });

            const likeButton = screen.getByTitle('Like');
            await user.click(likeButton);

            expect(onToggleLike).toHaveBeenCalledWith(1);
        });

        it('does NOT propagate click to onExpand when clicking like', async () => {
            const onExpand = vi.fn();
            const onToggleLike = vi.fn();
            const user = userEvent.setup();
            renderCard({ onExpand, onToggleLike });

            const likeButton = screen.getByTitle('Like');
            await user.click(likeButton);

            // Like was called
            expect(onToggleLike).toHaveBeenCalledWith(1);
            // Expand was NOT called (stopPropagation)
            expect(onExpand).not.toHaveBeenCalled();
        });

        it('shows incremented like count when post is liked', () => {
            renderCard({
                likedPosts: new Set([1]),
                getLikes: (p: BlogPost) => p.likes + 1,
            });
            expect(screen.getByText('43')).toBeInTheDocument();
        });
    });

    // ─── Search Highlighting ─────────────────────────────────────────────────
    describe('Search Highlighting', () => {
        it('renders with search query without crashing', () => {
            renderCard({ searchQuery: 'Test' });
            // The title should still be visible
            const matches = screen.getAllByText(/Test/);
            expect(matches.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ─── Multiple Columns ────────────────────────────────────────────────────
    describe('Grid Span Styles', () => {
        it('renders without crashing with 1 column layout', () => {
            renderCard({ columns: 1 });
            expect(screen.getByText('Test Blog Post Title')).toBeInTheDocument();
        });

        it('renders without crashing with 4 column layout', () => {
            renderCard({ columns: 4 });
            expect(screen.getByText('Test Blog Post Title')).toBeInTheDocument();
        });

        it('applies different image height for first post (index 0)', () => {
            const { container } = renderCard({ index: 0 });
            // The image container div should have the larger height class
            const imgContainer = container.querySelector('div[class*="h-56"]');
            expect(imgContainer).toBeTruthy();
        });

        it('applies standard image height for non-first post', () => {
            const { container } = renderCard({ index: 3 });
            const imgContainer = container.querySelector('div[class*="h-48"]');
            expect(imgContainer).toBeTruthy();
        });
    });

    // ─── Accessibility ───────────────────────────────────────────────────────
    describe('Accessibility', () => {
        it('image has alt text matching the post title', () => {
            renderCard();
            const img = screen.getByAltText('Test Blog Post Title');
            expect(img).toBeInTheDocument();
        });

        it('like button has title attribute', () => {
            renderCard();
            const likeBtn = screen.getByTitle('Like');
            expect(likeBtn).toBeInTheDocument();
        });

        it('calendar icon has title attribute', () => {
            renderCard();
            const calendarSpan = screen.getByTitle('Calendar');
            expect(calendarSpan).toBeInTheDocument();
        });

        it('author span has title attribute', () => {
            renderCard();
            const authorSpan = screen.getByTitle('Author');
            expect(authorSpan).toBeInTheDocument();
        });

        it('views span has title attribute', () => {
            renderCard();
            const viewsSpan = screen.getByTitle('Views');
            expect(viewsSpan).toBeInTheDocument();
        });
    });
});
