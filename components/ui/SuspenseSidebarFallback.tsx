/**
 * Shared loading skeleton for pages that use a sidebar + main layout.
 * Used as the Suspense fallback in DocsPage and GamesPage.
 */
export function SuspenseSidebarFallback() {
    return (
        <div
            className="flex w-full"
            style={{ background: 'var(--color-bg)', minHeight: '100vh' }}
        >
            <div
                className="w-96 animate-pulse"
                style={{ background: 'var(--color-surface)', minHeight: '100vh' }}
            />
            <div className="flex-1" />
        </div>
    );
}
