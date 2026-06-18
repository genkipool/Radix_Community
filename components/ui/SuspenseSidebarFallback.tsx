/**
 * Shared loading skeleton for pages that use a sidebar + main layout.
 * Used as the Suspense fallback in DocsPage and GamesPage.
 */
export function SuspenseSidebarFallback() {
    return (
        <div
            className="flex w-full flex-1"
            style={{ background: 'var(--color-bg)' }}
        >
            <div
                className="w-96 animate-pulse border-r"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}
            />
            <div className="flex-1" />
        </div>
    );
}
