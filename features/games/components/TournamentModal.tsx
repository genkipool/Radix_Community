'use client';

import { X, Trophy, Wallet, Star, Users, Gift } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useEffect, useState } from 'react';
import { type TournamentModalProps, type PrizeRow, type Currency, type XRDPrice } from '../types';
import { useXrdPrice } from '../hooks/useXrdPrice';

const PRIZE_TABLE: PrizeRow[] = [
  { rank: '1°', players: 1, prizeUSD: 130_000, totalUSD: 130_000, pct: '32.50%' },
  { rank: '2°', players: 1, prizeUSD: 68_000, totalUSD: 68_000, pct: '17.00%' },
  { rank: '3°', players: 1, prizeUSD: 30_000, totalUSD: 30_000, pct: '7.50%' },
  { rank: '4° – 10°', players: 7, prizeUSD: 2_000, totalUSD: 14_000, pct: '3.50%' },
  { rank: '11° – 100°', players: 90, prizeUSD: 200, totalUSD: 18_000, pct: '4.50%' },
  { rank: '101° – 1,000°', players: 900, prizeUSD: 50, totalUSD: 45_000, pct: '11.25%' },
  { rank: '1,001° – 20,000°', players: 19_000, prizeUSD: 5, totalUSD: 95_000, pct: '23.75%' },
  { rank: '20,001° – 100,000°', players: 80_000, prizeUSD: 0, totalUSD: 0, pct: '0.00%' },
];
const TOTAL_PRIZE_USD = 400_000;


/* ─── Helpers ────────────────────────────────────────────────────── */
function fmt(amount: number, currency: Currency, price: XRDPrice | null): string {
  if (amount === 0) return '—';
  if (currency === 'usd') return `$${amount.toLocaleString()}`;
  if (currency === 'eur') return `€${Math.round(amount * 0.92).toLocaleString()}`;
  if (currency === 'xrd' && price) return `${Math.round(amount / price.usd).toLocaleString()} XRD`;
  return `$${amount.toLocaleString()}`;
}

/* ─── Sub-components ─────────────────────────────────────────────── */
function Section({ icon, title, children, action }: { icon: React.ReactNode; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-base font-bold" style={{ color: 'var(--color-text-main)' }}>
          <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
          {title}
        </h3>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function StatBox({ value, label, gradient }: { value: string; label: string; gradient: string }) {
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
      <p className={`text-3xl font-black bg-gradient-to-br ${gradient} bg-clip-text text-transparent`}>{value}</p>
      <p className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
    </div>
  );
}

function XRDBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.4)', color: 'var(--color-primary)' }}
    >
      {children}
    </span>
  );
}

function CurrencyToggle({ currency, onChange, loading }: { currency: Currency; onChange: (c: Currency) => void; loading: boolean }) {
  const options: { value: Currency; label: string }[] = [
    { value: 'usd', label: 'USD $' },
    { value: 'eur', label: 'EUR €' },
    { value: 'xrd', label: 'XRD' },
  ];
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Currency">
      {options.map(opt => {
        const active = currency === opt.value;
        const disabled = opt.value === 'xrd' && loading;
        return (
          <button aria-label="button action"
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
            style={{
              background: active ? 'var(--color-primary)' : 'var(--color-surface)',
              color: active ? 'var(--color-bg)' : 'var(--color-text-muted)',
              border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-card-border)'}`,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {disabled ? '...' : opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main modal ─────────────────────────────────────────────────── */
export default function TournamentModal({ isOpen, onClose }: TournamentModalProps) {
  const { t: dict } = useLanguage();
  const t = (dict?.games?.tournament ?? {}) as unknown as Record<string, string>;

  const [currency, setCurrency] = useState<Currency>('usd');

  // XRD price via React Query — activated only when the modal is open.
  // If another component (LeaderboardSidebar, RadixInvaders) already requested the price,
  // React Query serves the value from cache with no additional requests.
  const { price: xrdPrice, isLoading: loadingPrice } = useXrdPrice({ enabled: isOpen });

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // XRD per-unit price string
  const xrdPriceStr = xrdPrice
    ? `1 XRD ≈ $${xrdPrice.usd.toFixed(4)}`
    : '';

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-label={t.title ?? 'Tournament Information'}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl flex flex-col"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)' }}
        >
          <div className="flex items-center gap-3">
            <Trophy className="size-6" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-main)' }}>
              {t.title ?? 'How Tournaments Work'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-muted)' }} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-8">

          {/* Registration — XRD highlighted */}
          <Section icon={<Wallet className="size-5" />} title={t.registration_title ?? 'Tournament Registration'}>
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {t.registration_desc ?? 'To register for the tournament, acquire your badge for 5 dollars paid in XRD. This badge gives you access to compete in weekly tournaments and register your scores on the official leaderboard.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                  {t.badge_price_label ?? 'Badge price:'}
                </span>
                <XRDBadge>$5 {t.paid_in ?? 'paid in'} XRD</XRDBadge>
                {xrdPrice && (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    ≈ {Math.round(5 / xrdPrice.usd).toLocaleString()} XRD
                    {xrdPriceStr && ` (${xrdPriceStr})`}
                  </span>
                )}
              </div>
            </div>
          </Section>

          {/* Distribution */}
          <Section icon={<Gift className="size-5" />} title={t.distribution_title ?? 'Revenue Distribution'}>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <StatBox value="80%" label={t.prizes_pool ?? 'Prize Pool'} gradient="from-green-500 to-emerald-400" />
              <StatBox value="20%" label={t.community_fund ?? 'Radix Fund'} gradient="from-blue-500 to-cyan-400" />
            </div>
            <div className="rounded-2xl p-3 flex flex-wrap gap-2 items-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                {t.prizes_paid_in ?? 'All prizes paid in:'}
              </span>
              <XRDBadge>XRD</XRDBadge>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t.prizes_xrd_note ?? '— directly to your Radix wallet, instantly.'}
              </span>
            </div>
          </Section>

          {/* Example with 100k players + currency toggle inline in title */}
          <Section
            icon={<Users className="size-5" />}
            title={t.example_title ?? 'Example with 100,000 players'}
            action={
              <CurrencyToggle
                currency={currency}
                onChange={setCurrency}
                loading={loadingPrice && !xrdPrice}
              />
            }
          >
            <div className="rounded-2xl p-4 text-sm mb-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>
                <strong style={{ color: 'var(--color-text-main)' }}>100,000</strong>{' '}
                {t.players_registered ?? 'players registered'}{' '}
                × <XRDBadge>$5 XRD</XRDBadge>{' '}
                = <strong style={{ color: 'var(--color-primary)' }}>$500,000</strong>{' '}
                {t.total_raised ?? 'raised'}{' '}
                → <strong style={{ color: 'var(--color-primary)' }}>$400,000</strong>{' '}
                {t.for_prizes ?? 'in prizes'}{' '}
                <XRDBadge>{t.in_xrd ?? 'in XRD'}</XRDBadge>
              </p>
            </div>

            {/* XRD live rate footnote */}
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-card-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-card-border)' }}>
                    {[
                      t.col_rank ?? 'Rank',
                      t.col_players ?? 'Players',
                      t.col_prize ?? 'Prize/Player',
                      t.col_total ?? 'Total',
                      t.col_pct ?? '% Pool',
                    ].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRIZE_TABLE.map((row, i) => (
                    <tr
                      key={row.rank}
                      style={{
                        borderBottom: i < PRIZE_TABLE.length - 1 ? '1px solid var(--color-card-border)' : 'none',
                        background: i < 3 ? `rgba(99,102,241,${0.06 - i * 0.015})` : 'transparent',
                      }}
                    >
                      <td className="px-3 py-2.5 font-semibold" style={{ color: i < 3 ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                        {row.rank}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: 'var(--color-text-muted)' }}>
                        {row.players.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: row.prizeUSD === 0 ? 'var(--color-text-muted)' : 'var(--color-text-main)' }}>
                        {fmt(row.prizeUSD, currency, xrdPrice)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {fmt(row.totalUSD, currency, xrdPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {row.pct}
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: 'var(--color-surface)', borderTop: '2px solid var(--color-card-border)' }}>
                    <td className="px-3 py-2.5 font-bold" style={{ color: 'var(--color-text-main)' }} colSpan={2}>
                      TOTAL
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 font-bold" style={{ color: 'var(--color-primary)' }}>
                      {fmt(TOTAL_PRIZE_USD, currency, xrdPrice)}
                    </td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: 'var(--color-text-main)' }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* XRD live rate footnote */}
            {currency === 'xrd' && xrdPrice && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                * {t.xrd_rate_note ?? 'Amounts calculated using live XRD price:'}{' '}
                <strong style={{ color: 'var(--color-primary)' }}>${xrdPrice.usd.toFixed(4)} / XRD</strong>
              </p>
            )}
          </Section>

          {/* Why so many winners */}
          <Section icon={<Star className="size-5" />} title={t.why_title ?? 'Why reward so many players?'}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {t.why_desc ?? 'We have chosen to reward such a wide percentage of players (top 20%) to demonstrate the real potential of Radix as a payment and micropayment platform. Having 20,000 people receive prizes in XRD is a powerful demonstration of the speed, scalability and low cost of Radix transactions.'}
            </p>
          </Section>

          {/* Duration */}
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
            <Trophy className="size-5 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-main)' }}>
                {t.duration_title ?? 'Weekly Tournaments'}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t.duration_desc ?? 'Tournaments last one week. Register early to play more games and maximise your chances of winning.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
