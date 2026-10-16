'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * The first thing the claim and recover tools say: who the page is for and
 * what it takes out of a locker, with a way to the other one. The two look
 * alike (both take tokens out of a locker), so each says plainly which side
 * of the airdrop it serves.
 */
export function LockerRoleNote({
  icon: Icon,
  who,
  what,
  other,
}: {
  icon: LucideIcon;
  /** "For whoever received the airdrop". */
  who: string;
  /** What the page does, in one sentence. */
  what: string;
  /** The other tool, for whoever is on the other side. */
  other: { question: string; label: string; href: string };
}) {
  return (
    <div className="flex gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)' }}>
      <span className="size-9 shrink-0 rounded-full grid place-items-center" style={{ background: 'rgba(236,72,153,0.12)' }}>
        <Icon className="size-4" style={{ color: 'rgb(236,72,153)' }} />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>{who}</p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{what}</p>
        <p className="pt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {other.question}{' '}
          <Link href={other.href} className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
            {other.label}
          </Link>
        </p>
      </div>
    </div>
  );
}
