/** Shown instantly while a vote's page loads (the sidebar stays in place). */
export default function Loading() {
    return (
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-16 animate-pulse" aria-busy="true">
            <div className="h-3 w-32 rounded bg-[var(--color-surface-hover)]" />
            <div className="mt-5 flex gap-2">
                <div className="h-5 w-28 rounded-full bg-[var(--color-surface-hover)]" />
                <div className="h-5 w-20 rounded-full bg-[var(--color-surface-hover)]" />
            </div>
            <div className="mt-4 h-9 w-3/4 rounded-lg bg-[var(--color-surface-hover)]" />
            <div className="mt-3 h-4 w-2/3 rounded bg-[var(--color-surface-hover)]" />
            <div className="mt-8 h-8 w-56 rounded bg-[var(--color-surface-hover)]" />
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
                <div className="space-y-3">
                    {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-4 rounded bg-[var(--color-surface-hover)]" style={{ width: `${90 - (i % 3) * 12}%` }} />)}
                </div>
                <div className="h-72 rounded-2xl bg-[var(--color-surface-hover)]" />
            </div>
        </div>
    );
}
