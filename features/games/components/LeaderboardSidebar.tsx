'use client';
import { SafeImage } from '@/components/ui/SafeImage';
import { Trophy, Info, Users, Award } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { MOCK_LEADERBOARD } from '../data/gamesData';
import { type LeaderboardUser, type LeaderboardSidebarProps } from '../types';
import { SearchBar } from '@/components/ui/SearchBar';
import TournamentModal from './TournamentModal';
import { formatUSD } from '@/features/games/utils/xrdPrice';
import { useXrdPrice } from '../hooks/useXrdPrice';
import type { Dictionary } from '@/i18n';

/* ─── Constants ──────────────────────────────────────────────────── */
const TOTAL_PARTICIPANTS = 12_847;
const PRIZE_RECEIVERS_PCT = 0.2;
const PRIZE_RECEIVERS = Math.round(TOTAL_PARTICIPANTS * PRIZE_RECEIVERS_PCT);
const PRIZE_POOL_USD = Math.round(TOTAL_PARTICIPANTS * 5 * 0.8);
const HI_KEY = 'si_radix_hiscore_v2';

function loadHiScore(): number {
    try { return parseInt(localStorage.getItem(HI_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

/** Compute simulated rank from real hi-score against the mock leaderboard */
function computeRank(hiScore: number, leaderboard: LeaderboardUser[]): number {
    if (hiScore <= 0) return TOTAL_PARTICIPANTS;
    const playersAbove = leaderboard.filter(u => u.score > hiScore).length;
    const ratio = playersAbove / leaderboard.length;
    return Math.max(1, Math.round(ratio * TOTAL_PARTICIPANTS) + 1);
}

/* ─── Medal helpers ───────────────────────────────────────────────── */
const MEDAL_COLORS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

function MedalSVG({ rank }: { rank: number }) {
    if (rank > 3) return null;
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'inline', marginLeft: 4, verticalAlign: 'middle' }}>
            <circle cx="7" cy="7" r="6" fill={colors[rank - 1]} opacity="0.9" />
            <text x="7" y="10.5" textAnchor="middle" fontSize="8" fontWeight="bold" fill="rgba(0,0,0,0.6)">{rank}</text>
        </svg>
    );
}

function PlayerAvatar({ user, size = 36 }: { user: LeaderboardUser; size?: number }) {
    const medal = MEDAL_COLORS[user.rank];
    return (
        <div className="relative shrink-0 rounded-full overflow-hidden" style={{ width: size, height: size, border: `2px solid ${medal ?? 'var(--color-card-border)'}` }}>
            <SafeImage src={user.avatarUrl} alt={user.username} fallbackName={user.username} className="w-full h-full object-cover" loading="lazy" />
        </div>
    );
}

function RankBadge({ rank }: { rank: number }) {
    const medal = MEDAL_COLORS[rank];
    if (medal) return <span className="text-[10px] font-black size-5 flex items-center justify-center rounded-full shrink-0" style={{ background: medal, color: '#000' }}>{rank}</span>;
    return <span className="text-[10px] font-bold w-5 text-center shrink-0" style={{ color: 'var(--color-text-muted)' }}>#{rank}</span>;
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
    return (
        <div className="flex-1 flex flex-col items-center gap-0.5 p-2 rounded-xl text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
            <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>{value}</span>
            <span className="text-[10px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        </div>
    );
}

function XRDChipIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1" />
            <text x="6.5" y="10" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="currentColor">X</text>
        </svg>
    );
}

/* ─── Main component ─────────────────────────────────────────────── */

export default function LeaderboardSidebar({ gameTitle, dictionary }: LeaderboardSidebarProps & { dictionary?: Partial<Dictionary> }) {
    const { t: dict } = useLanguage();
    const t = (dictionary?.games?.leaderboard || dict?.games?.leaderboard || {}) as unknown as Record<string, string>;

    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hiScore, setHiScore] = useState(() => {
        if (typeof window !== 'undefined') return loadHiScore();
        return 0;
    });

    // XRD price via React Query — shared cache with TournamentModal and RadixInvaders
    const { price: xrdPrice } = useXrdPrice();

    // Poll real hi-score from localStorage every 2s
    // (correct useEffect: synchronization effect with localStorage, not a data fetch)
    useEffect(() => {
        const id = setInterval(() => setHiScore(loadHiScore()), 2000);
        return () => clearInterval(id);
    }, []);

    const prizePoolStr = xrdPrice ? formatUSD(PRIZE_POOL_USD) : `$${PRIZE_POOL_USD.toLocaleString()}`;
    // React Compiler automatically memoizes these derived calculations.
    const liveRank = computeRank(hiScore, MOCK_LEADERBOARD);

    const filteredLeaderboard = !searchQuery.trim()
        ? MOCK_LEADERBOARD
        : MOCK_LEADERBOARD.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

    const sidebarInner = (
        <>
            {/* ── Sticky header ── */}
            <div className="sticky top-0 z-20 flex flex-col gap-0" style={{ background: 'var(--color-bg)' }}>

                {/* Game title + stats */}
                <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--color-card-border)' }}>
                    <div className="flex items-start gap-2 mb-3">
                        <Trophy className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-primary)' }}>
                                {t.section_title ?? 'Tournament'}
                            </p>
                            <h3 className="text-sm font-bold leading-tight truncate" style={{ color: 'var(--color-text-main)' }}>
                                {gameTitle}
                            </h3>
                        </div>
                    </div>

                    <div className="flex gap-2 mb-3">
                        <StatChip icon={<XRDChipIcon />} value={prizePoolStr} label={t.stat_pool ?? 'Prize Pool'} />
                        <StatChip icon={<Users className="size-3.5" />} value={TOTAL_PARTICIPANTS.toLocaleString()} label={t.stat_total ?? 'Players'} />
                        <StatChip icon={<Award className="size-3.5" />} value={PRIZE_RECEIVERS.toLocaleString()} label={t.stat_winners ?? 'Winners'} />
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                    >
                        <Info className="size-3.5" />
                        {t.more_info ?? 'Tournament info & prizes'}
                    </button>
                </div>

                {/* ── Live position — real data from localStorage ── */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-card-border)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        {t.your_position ?? 'Your position'}
                    </p>
                    <div
                        className="flex items-center gap-3 p-2.5 rounded-xl"
                        style={{
                            background: `linear-gradient(135deg, rgba(var(--color-primary-rgb,99,102,241),0.12) 0%, transparent 100%)`,
                            border: '1px solid var(--color-primary)',
                        }}
                    >
                        {/* Avatar with live pulse dot */}
                        <div className="relative shrink-0">
                            <div
                                className="size-9 rounded-full overflow-hidden border-2"
                                style={{ borderColor: 'var(--color-primary)' }}
                            >
                                <SafeImage
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=CurrentUser`}
                                    alt="You"
                                    fallbackName="You"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </div>
                            <span
                                className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 animate-pulse"
                                style={{ background: '#22c55e', borderColor: 'var(--color-bg)' }}
                            />
                        </div>

                        {/* Rank */}
                        <span className="text-lg font-black shrink-0" style={{ color: 'var(--color-primary)' }}>
                            {hiScore > 0 ? `#${liveRank.toLocaleString()}` : '—'}
                        </span>

                        {/* Score info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                                {t.your_record ?? 'Your record'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-primary)' }}>
                                {hiScore > 0
                                    ? `${hiScore.toLocaleString()} ${t.pts ?? 'pts'}`
                                    : (t.no_score ?? 'Play to get on the board!')}
                            </p>
                        </div>

                        {/* Live badge */}
                        <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: '#22c55e', color: '#fff' }}
                        >
                            {t.live ?? 'LIVE'}
                        </span>
                    </div>
                </div>

                {/* ── Leaderboard title + search ── */}
                <div className="px-4 pt-3 pb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        {t.top_players ?? 'Top Players'}
                    </p>
                    <SearchBar variant="sidebar" value={searchQuery} onChange={setSearchQuery} placeholder={t.search_placeholder ?? 'Search players…'} />
                </div>
            </div>

            {/* ── Leaderboard rows ── */}
            <div className="flex-1 px-4 pb-8 pt-2 space-y-2">
                {filteredLeaderboard.length === 0 ? (
                    <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {t.no_results ?? 'No players found'}
                    </p>
                ) : (
                    filteredLeaderboard.map(user => {
                        const medal = MEDAL_COLORS[user.rank];
                        return (
                            <div key={user.rank} className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-card-bg)', border: medal ? `1.5px solid ${medal}` : '1px solid var(--color-card-border)' }}>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <PlayerAvatar user={user} size={36} />
                                    <RankBadge rank={user.rank} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
                                            {user.username}<MedalSVG rank={user.rank} />
                                        </p>
                                        <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                                            {user.score.toLocaleString()} {t.pts ?? 'pts'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );

    return (
        <>
            <TournamentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            <aside
                className="w-full md:w-80 lg:w-88 flex flex-col border-l shrink-0"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}
            >
                <div className="hidden md:flex flex-col overflow-y-auto md:sticky md:top-20" style={{ height: 'calc(100vh - 80px)', scrollbarWidth: 'none' }}>
                    {sidebarInner}
                </div>
                <div className="md:hidden flex flex-col">{sidebarInner}</div>
            </aside>
        </>
    );
}
